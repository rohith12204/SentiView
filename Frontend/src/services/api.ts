import axios from "axios";

// BUG FIX: was pointing to /api/analyze/ — correct path is /api/sentiment/analyze/
export const analyzeSentiment = async (text: string) => {
  const response = await axios.post(
    "https://sentiview-api-j728.onrender.com",
    { text }
  );
  return response.data;
};
