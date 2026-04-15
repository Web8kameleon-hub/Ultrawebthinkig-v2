"""
🚀 CLISONIX DOMAIN DEPLOYMENT GUIDE
Ultra Industrial Platform - Production Deployment

STRATO Hosting Details:
- Primary Domain: clisonix.com
- App Domain: app.clisonix.com
- API Domain: api.clisonix.com
- Neuro Domain: neuro.clisonix.com
- Legacy Redirect: kameleon.life
- Server: 570523285.swh.strato-hosting.eu
- Path: /mnt/rid/32/85/570523285/htdocs
- Webspace: 100 GB available
- Databases: 25 MySQL available
- SSL: Available for secure connections
"""

# SFTP Connection Configuration
SFTP_CONFIG = {
    "host": "570523285.swh.strato-hosting.eu",
    "username": "Master-ID", 
    "password": "(password i ri)",  # Update after password change
    "remote_path": "/mnt/rid/32/85/570523285/htdocs",
    "port": 22
}

# Deployment Configuration for Clisonix domains
CLISONIX_DEPLOYMENT = {
    "primary_domain": "clisonix.com",
    "app_domain": "app.clisonix.com",
    "legacy_redirect_domain": "kameleon.life",
    "environment": "production",
    "ssl_enabled": True,
    "services": {
        "frontend": {
            "port": 80,
            "build_command": "yarn build",
            "start_command": "yarn start",
            "public_url": "https://app.clisonix.com",
        },
        "asi_backend": {
            "port": 8080,
            "service": "UltraCom FastAPI",
            "subdomain": "api.clisonix.com",
        },
        "neurosonix": {
            "port": 8081,
            "service": "NeuroSonix Neural API",
            "subdomain": "neuro.clisonix.com",
        },
    },
}

# Backwards-compatible alias for existing imports/scripts.
KAMELEON_DEPLOYMENT = CLISONIX_DEPLOYMENT

# Deployment Steps for STRATO Hosting
DEPLOYMENT_STEPS = [
    "1. Change master password on STRATO dashboard",
    "2. Create production build: yarn build",
    "3. Upload build files via SFTP to /htdocs",
    "4. Configure DNS for clisonix.com, app/api/neuro subdomains, and kameleon.life redirect",
    "5. Set up MySQL database for API storage",
    "6. Configure environment variables",
    "7. Enable SSL certificates for clisonix.com and subdomains",
    "8. Test all three services (Frontend, ASI, NeuroSonix)",
    "9. Launch business with API collection system",
]

print("🌟 Clisonix domain deployment configuration ready!")
print("📊 100 GB webspace + 25 databases available")
print("🔐 SSL certificate ready for secure connections")
print("↪️  Keep kameleon.life configured as a redirect to app.clisonix.com")
