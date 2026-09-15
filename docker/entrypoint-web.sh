#!/bin/sh
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput

# porta 80: frontend/nginx.conf faz "proxy_pass http://rh-backend/..." sem
# porta explicita, ou seja, espera o upstream escutando na 80 (nao 8000,
# usado so em dev com o Vite na frente)
exec daphne -b 0.0.0.0 -p 80 config.asgi:application
