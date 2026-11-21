FROM php:8.3-apache

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && docker-php-ext-install pdo_mysql \
    && a2enmod headers rewrite \
    && sed -ri 's/^Listen 80$/Listen 8000/' /etc/apache2/ports.conf \
    && sed -ri 's/<VirtualHost \*:80>/<VirtualHost *:8000>/' /etc/apache2/sites-available/000-default.conf \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html
COPY . /var/www/html

RUN mkdir -p storage/uploads storage/avatars storage/sessions \
    && chown -R www-data:www-data storage \
    && chmod -R 750 storage

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=12 \
    CMD curl --fail --silent "http://127.0.0.1:8000/api/index.php?route=health" >/dev/null || exit 1

