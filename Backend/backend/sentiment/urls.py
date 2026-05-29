from django.urls import path
from .views import analyze_sentiment

urlpatterns = [
    path("analyze/", analyze_sentiment),


]
