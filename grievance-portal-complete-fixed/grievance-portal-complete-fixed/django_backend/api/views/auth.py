import json
import os
import jwt
import re
from datetime import datetime, timedelta
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings
from django.utils import timezone
from api.models import User, Notification
from api.middleware.auth import jwt_auth_required, jwt_optional_auth, verify_jwt_token

def generate_token(user_id, role):
    exp = datetime.utcnow() + timedelta(days=7)
    payload = {
        'userId': str(user_id),
        'role': role,
        'exp': exp
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')

def generate_refresh_token(user_id):
    exp = datetime.utcnow() + timedelta(days=30)
    payload = {
        'userId': str(user_id),
        'exp': exp
    }
    secret = os.getenv('JWT_REFRESH_SECRET', settings.SECRET_KEY)
    return jwt.encode(payload, secret, algorithm='HS256')

@csrf_exempt
@require_http_methods(["POST"])
def register_view(request):
    try:
        body = json.loads(request.body)
    except ValueError:
        return JsonResponse({'success': False, 'message': 'Invalid JSON'}, status=400)

    name = body.get('name', '').strip()
    email = body.get('email', '').strip().lower()
    password = body.get('password', '')
    phone = body.get('phone', '').strip() if body.get('phone') else None
    state = body.get('state', '').strip().lower()
    district = body.get('district', '').strip().lower()

    if not name or not email or not password or not state or not district:
        return JsonResponse({'success': False, 'message': 'All fields are required'}, status=400)

    # Check existing user
    if User.objects.filter(email=email).exists():
        return JsonResponse({
            'success': False,
            'message': 'Email already registered. Please login.',
            'errors': [{'field': 'email', 'message': 'This email is already in use'}]
        }, status=400)

    # Validate password complexity
    if not re.match(r'^(?=.*[a-z])^(?=.*[A-Z])^(?=.*\d).+$', password):
        return JsonResponse({
            'success': False,
            'message': 'Password must contain uppercase, lowercase, and number',
            'errors': [{'field': 'password', 'message': 'Password does not meet complexity requirements'}]
        }, status=400)

    try:
        user = User(
            name=name,
            email=email,
            phone=phone,
            state=state,
            district=district,
            role='citizen',
            is_active=True,
            is_verified=False
        )
        user.set_password(password)
        user.save()

        token = generate_token(user.id, user.role)
        refresh_token = generate_refresh_token(user.id)

        return JsonResponse({
            'success': True,
            'message': 'Registration successful',
            'data': {
                'token': token,
                'refreshToken': refresh_token,
                'user': {
                    'id': user.id,
                    'name': user.name if hasattr(user, 'name') else user.first_name, # handles name field fallback
                    'email': user.email,
                    'role': user.role,
                    'state': user.state,
                    'district': user.district,
                    'phone': user.phone,
                }
            }
        }, status=201)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': 'Registration failed. Please try again.',
            'errors': [{'field': 'general', 'message': str(e)}]
        }, status=500)

# Add name property fallback dynamically to User model for compatibility
if not hasattr(User, 'name'):
    @property
    def user_name_prop(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email.split('@')[0]
    @user_name_prop.setter
    def user_name_prop(self, value):
        parts = value.split(' ', 1)
        self.first_name = parts[0]
        self.last_name = parts[1] if len(parts) > 1 else ''
    User.name = user_name_prop

@csrf_exempt
@require_http_methods(["POST"])
def login_view(request):
    try:
        body = json.loads(request.body)
    except ValueError:
        return JsonResponse({'success': False, 'message': 'Invalid JSON'}, status=400)

    email = body.get('email', '').strip().lower()
    password = body.get('password', '')

    if not email or not password:
        return JsonResponse({'success': False, 'message': 'Email and password required'}, status=400)

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Invalid email or password.'}, status=401)

    if not user.is_active:
        return JsonResponse({'success': False, 'message': 'Account is deactivated. Contact support.'}, status=401)

    if not user.check_password(password):
        return JsonResponse({'success': False, 'message': 'Invalid email or password.'}, status=401)

    # Update last login
    user.last_login_at = timezone.now()
    user.save(update_fields=['last_login_at'])

    token = generate_token(user.id, user.role)
    refresh_token = generate_refresh_token(user.id)

    return JsonResponse({
        'success': True,
        'message': 'Login successful',
        'data': {
            'token': token,
            'refreshToken': refresh_token,
            'user': {
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'role': user.role,
                'state': user.state,
                'district': user.district,
                'phone': user.phone,
                'authorityType': user.authority_type,
                'jurisdiction': user.jurisdiction,
            }
        }
    })

@csrf_exempt
@require_http_methods(["POST"])
def refresh_token_view(request):
    try:
        body = json.loads(request.body)
    except ValueError:
        return JsonResponse({'success': False, 'message': 'Invalid JSON'}, status=400)

    token = body.get('refreshToken', '')
    if not token:
        return JsonResponse({'success': False, 'message': 'Refresh token required.'}, status=400)

    payload = verify_jwt_token(token, is_refresh=True)
    if 'error' in payload:
        return JsonResponse({'success': False, 'message': payload['error']}, status=401)

    user_id = payload.get('userId')
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'User not found.'}, status=404)

    new_token = generate_token(user.id, user.role)
    return JsonResponse({
        'success': True,
        'data': {'token': new_token}
    })

@csrf_exempt
@jwt_auth_required
@require_http_methods(["GET", "PUT"])
def profile_view(request):
    user = request.user
    if request.method == "GET":
        return JsonResponse({
            'success': True,
            'data': {
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'role': user.role,
                'phone': user.phone,
                'state': user.state,
                'district': user.district,
                'complaintsCount': user.complaints_count,
                'authorityType': user.authority_type,
                'authorityId': user.authority_id,
                'jurisdiction': user.jurisdiction,
                'isActive': user.is_active,
                'isVerified': user.is_verified,
            }
        })
    elif request.method == "PUT":
        try:
            body = json.loads(request.body)
        except ValueError:
            return JsonResponse({'success': False, 'message': 'Invalid JSON'}, status=400)

        name = body.get('name')
        phone = body.get('phone')
        state = body.get('state')
        district = body.get('district')

        if name:
            user.name = name.strip()
        if phone:
            user.phone = phone.strip()
        if state:
            user.state = state.strip().lower()
        if district:
            user.district = district.strip().lower()
            
        user.save()
        return JsonResponse({'success': True, 'message': 'Profile updated successfully.'})

@csrf_exempt
@jwt_auth_required
@require_http_methods(["PUT"])
def change_password_view(request):
    try:
        body = json.loads(request.body)
    except ValueError:
        return JsonResponse({'success': False, 'message': 'Invalid JSON'}, status=400)

    current_password = body.get('currentPassword', '')
    new_password = body.get('newPassword', '')

    user = request.user
    if not user.check_password(current_password):
        return JsonResponse({'success': False, 'message': 'Current password is incorrect.'}, status=400)

    user.set_password(new_password)
    user.save()
    return JsonResponse({'success': True, 'message': 'Password changed successfully.'})

@csrf_exempt
@jwt_auth_required
@require_http_methods(["GET"])
def notifications_view(request):
    user = request.user
    notifications = Notification.objects.filter(user_id=user.id).order_by('-created_at')[:20]
    
    data = []
    for n in notifications:
        data.append({
            'id': n.id,
            'userId': n.user_id,
            'type': n.type,
            'title': n.title,
            'message': n.message,
            'metadata': n.metadata,
            'isRead': n.is_read,
            'createdAt': n.created_at.isoformat()
        })
    return JsonResponse({'success': True, 'data': data})

@csrf_exempt
@jwt_auth_required
@require_http_methods(["PUT"])
def mark_all_notifications_read_view(request):
    user = request.user
    unread = Notification.objects.filter(user_id=user.id, is_read=False)
    count = unread.count()
    unread.update(is_read=True)
    return JsonResponse({
        'success': True,
        'message': f"{count} notifications marked as read."
    })

@csrf_exempt
@jwt_auth_required
@require_http_methods(["PUT"])
def mark_notification_read_view(request, id):
    try:
        notification = Notification.objects.get(id=id, user_id=request.user.id)
        notification.is_read = True
        notification.save()
        return JsonResponse({'success': True, 'message': 'Notification marked as read.'})
    except Notification.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Notification not found.'}, status=404)
