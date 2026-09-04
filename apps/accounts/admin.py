from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Company, Setor, User


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ["id", "nome", "active"]


@admin.register(Setor)
class SetorAdmin(admin.ModelAdmin):
    list_display = ["id", "nome", "company", "active"]


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ["id", "username", "email", "role", "company", "setor", "is_active"]
    fieldsets = DjangoUserAdmin.fieldsets + ((None, {"fields": ("company", "role", "setor")}),)
