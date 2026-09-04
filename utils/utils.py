from rest_framework.exceptions import ValidationError


def capture_company_id(request) -> str:
    company_id = request.headers.get("X-Company-ID")
    if not company_id:
        raise ValidationError({"X-Company-ID": "Header obrigatório."})
    return company_id
