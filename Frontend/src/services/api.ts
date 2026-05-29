import axios from "axios";

// BUG FIX: was pointing to /api/analyze/ — correct path is /api/sentiment/analyze/
export const analyzeSentiment = async (text: string) => {
  const response = await axios.post(
    "http://127.0.0.1:8000/api/sentiment/analyze/",
    { text }
  );
  return response.data;
};
