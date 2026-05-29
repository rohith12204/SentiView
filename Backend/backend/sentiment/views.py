from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from ml.inference import predict_sentiment


@api_view(["POST"])
def analyze_sentiment(request):
    text = request.data.get("text", "").strip()

    if not text:
        return Response(
            {"error": "Text is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    result = predict_sentiment(text)

    response_data = {
        "text":       text,
        "sentiment":  result["label"],     # positive / negative / uncertain
        "confidence": result["confidence"],
        "scores":     result["scores"]
    }

    # BUG FIX: include reason when present (e.g. non-English or model not loaded)
    if "reason" in result:
        response_data["reason"] = result["reason"]

    return Response(response_data)
