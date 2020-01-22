from rest_framework.permissions import BasePermission, IsAuthenticated, SAFE_METHODS

class AllowMetadata(BasePermission):
    def has_permission(self, request, view):
        return request.method in ['OPTIONS', 'HEAD']

def is_admin_director(user):
    return bool(user.is_staff or user.member.is_director or user.member.is_staff)

class IsObjOwnerOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        return bool(request.user
            and (obj.user == request.user
                or is_admin_director(request.user)
            )
        )

class IsSessionInstructorOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        return bool(request.user
            and (obj.session.instructor == request.user
                or is_admin_director(request.user)
            )
        )

class ReadOnly(BasePermission):
    def has_permission(self, request, view):
        return bool(request.method in SAFE_METHODS)
    def has_object_permission(self, request, view, obj):
        return bool(request.method in SAFE_METHODS)

class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.method in SAFE_METHODS
            or request.user
            and is_admin_director(request.user)
        )

class IsInstructorOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.method in SAFE_METHODS
            or request.user
            and request.user.member.is_instructor
        )
