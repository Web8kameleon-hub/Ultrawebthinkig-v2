# Domain Routing

Ky folder përmban config-et bazë për kalimin te `clisonix.com` si primary domain dhe mbajtjen e `kameleon.life` si redirect legacy.

## Files

- `nginx-clisonix.conf`: virtual hosts për `clisonix.com`, `app.clisonix.com`, `api.clisonix.com`, `neuro.clisonix.com`, dhe redirect për `kameleon.life`.
- `apache-kameleon-redirect.conf`: redirect permanent për Apache ose `.htaccess`.

## Routing i synuar

- `https://clisonix.com` → corporate / landing
- `https://app.clisonix.com` → Next.js frontend
- `https://api.clisonix.com` → backend në port `8080`
- `https://neuro.clisonix.com` → NeuroSonix në port `8081`
- `https://kameleon.life` → `301` te `https://app.clisonix.com`

## Nginx

1. Kopjo `nginx-clisonix.conf` te serveri.
2. Përditëso path-et e SSL nëse certifikatat kanë emër tjetër.
3. Aktivizo config-un dhe reload `nginx`.

```bash
sudo cp deploy/domain-routing/nginx-clisonix.conf /etc/nginx/sites-available/clisonix.conf
sudo ln -s /etc/nginx/sites-available/clisonix.conf /etc/nginx/sites-enabled/clisonix.conf
sudo nginx -t
sudo systemctl reload nginx
```

## Apache

Për redirect të thjeshtë, përdor `apache-kameleon-redirect.conf` si vhost snippet ose si `.htaccess` në root-in e `kameleon.life`.

```bash
sudo cp deploy/domain-routing/apache-kameleon-redirect.conf /var/www/kameleon.life/.htaccess
```

## Kontrolli i shpejtë

```bash
curl -I https://kameleon.life
curl -I https://app.clisonix.com
curl -I https://api.clisonix.com
curl -I https://neuro.clisonix.com
```
