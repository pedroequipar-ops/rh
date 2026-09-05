from rest_framework.permissions import BasePermission

ROLE_PERMISSIONS = {
    "RH": {
        "setores.view",
        "setores.create",
        "setores.edit",
        "setores.delete",
        "usuarios.view",
        "usuarios.create",
        "usuarios.edit",
        "usuarios.delete",
        "etapas.view",
        "etapas.create",
        "etapas.edit",
        "etapas.delete",
        "etapas.reorder",
        "vagas.view",
        "vagas.create",
        "vagas.edit",
        "vagas.delete",
        "vagas.candidatos",
        "candidatos.view",
        "candidatos.create",
        "candidatos.edit",
        "candidatos.delete",
        "candidatos.upload_url",
        "candidatos.analisar_curriculo",
        "candidatos.curriculo_url",
        "candidatos.mensagens",
        "candidatos.mover_etapa",
    },
    "SETOR": {
        "setores.view",
        "etapas.view",
        "vagas.view",
        "vagas.create",
        "vagas.edit",
        "vagas.delete",
        "vagas.candidatos",
        "candidatos.view",
        "candidatos.curriculo_url",
        "candidatos.mensagens",
    },
}


class HasFunctionPermission(BasePermission):
    """RBAC simplificado [decisão local]: resolve contra ``request.user.role``
    em vez de ``Positions/PositionFunction`` (inexistentes neste repo),
    mantendo a mesma API pública (``permission_path``/``permission_action_map``)
    do padrão para compatibilidade futura."""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_superuser:
            return True

        permission_path = getattr(view, "permission_path", None)
        permission_action_map = getattr(view, "permission_action_map", None)
        if not permission_path or not permission_action_map:
            return True

        action = getattr(view, "action", None)
        required = permission_action_map.get(action)
        if required is None:
            return True

        allowed = ROLE_PERMISSIONS.get(user.role, set())
        return required in allowed
