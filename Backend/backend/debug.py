import traceback
import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

try:
    from analytics.views import product_details
    from django.test import RequestFactory
    req = RequestFactory().get('/', {'name': 'OPPO Reno 11'})
    req.method = 'GET'
    response = product_details(req)
    print("SUCCESS:", response.status_code, response.data)
except Exception as e:
    traceback.print_exc()
