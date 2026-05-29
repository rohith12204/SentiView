import { Product } from '../types';

export const mockProducts: Product[] = [
  {
    id: '1',
    name: 'iPhone 15 Pro',
    brand: 'Apple',
    model: 'A2848',
    image: 'https://images.pexels.com/photos/788946/pexels-photo-788946.jpeg?auto=compress&cs=tinysrgb&w=400',
    rating: 4.5,
    sentimentScore: 85,
    price: '$999',
    specs: {
      ram: '8GB',
      battery: '3274 mAh',
      display: '6.1" OLED',
      processor: 'A17 Pro'
    },
    aspects: [
      { aspect: 'Camera Quality', score: 90, positiveCount: 4500, negativeCount: 500 },
      { aspect: 'Battery Life', score: 65, positiveCount: 3250, negativeCount: 1750 },
      { aspect: 'Performance', score: 92, positiveCount: 4600, negativeCount: 400 },
      { aspect: 'Design', score: 88, positiveCount: 4400, negativeCount: 600 },
      { aspect: 'Price/Value', score: 60, positiveCount: 3000, negativeCount: 2000 }
    ],
    pros: [
      'Exceptional camera performance with 48MP main sensor',
      'A17 Pro chip delivers blazing fast performance',
      'Premium titanium build feels luxurious',
      'ProMotion display is incredibly smooth'
    ],
    cons: [
      'Heating issues under heavy gaming',
      'Battery life disappointing for the price',
      'Very expensive compared to competitors',
      'USB-C limited to USB 2.0 speeds on base model'
    ],
    summary: 'Users love the new A17 Pro chip and camera performance. The titanium design feels premium and durable. However, heating issues persist under heavy use and battery life could be better for the price point.',
    trendData: [
      { month: 'Jan', positive: 75, negative: 15, neutral: 10 },
      { month: 'Feb', positive: 78, negative: 14, neutral: 8 },
      { month: 'Mar', positive: 82, negative: 12, neutral: 6 },
      { month: 'Apr', positive: 85, negative: 10, neutral: 5 },
      { month: 'May', positive: 83, negative: 12, neutral: 5 },
      { month: 'Jun', positive: 85, negative: 10, neutral: 5 }
    ]
  },
  {
    id: '2',
    name: 'Galaxy S23 Ultra',
    brand: 'Samsung',
    model: 'SM-S918B',
    image: 'https://images.pexels.com/photos/404280/pexels-photo-404280.jpeg?auto=compress&cs=tinysrgb&w=400',
    rating: 4.6,
    sentimentScore: 88,
    price: '$1,199',
    specs: {
      ram: '12GB',
      battery: '5000 mAh',
      display: '6.8" AMOLED',
      processor: 'Snapdragon 8 Gen 2'
    },
    aspects: [
      { aspect: 'Camera Quality', score: 94, positiveCount: 4700, negativeCount: 300 },
      { aspect: 'Battery Life', score: 85, positiveCount: 4250, negativeCount: 750 },
      { aspect: 'Performance', score: 90, positiveCount: 4500, negativeCount: 500 },
      { aspect: 'Design', score: 82, positiveCount: 4100, negativeCount: 900 },
      { aspect: 'Price/Value', score: 70, positiveCount: 3500, negativeCount: 1500 }
    ],
    pros: [
      'Best-in-class camera system with 200MP sensor',
      'Excellent battery life lasts all day',
      'S Pen integration is incredibly useful',
      'Gorgeous display with amazing brightness'
    ],
    cons: [
      'Expensive price point',
      'Large size makes one-handed use difficult',
      'Heavy at 234g',
      'OneUI can feel bloated with duplicate apps'
    ],
    summary: 'The S23 Ultra impresses with its 200MP camera and S Pen functionality. Battery life is excellent and the display is stunning. The main drawbacks are its high price and bulky size.',
    trendData: [
      { month: 'Jan', positive: 80, negative: 12, neutral: 8 },
      { month: 'Feb', positive: 83, negative: 11, neutral: 6 },
      { month: 'Mar', positive: 86, negative: 9, neutral: 5 },
      { month: 'Apr', positive: 88, negative: 8, neutral: 4 },
      { month: 'May', positive: 87, negative: 9, neutral: 4 },
      { month: 'Jun', positive: 88, negative: 8, neutral: 4 }
    ]
  },
  {
    id: '3',
    name: 'Pixel 8 Pro',
    brand: 'Google',
    model: 'GC3VE',
    image: 'https://images.pexels.com/photos/1092644/pexels-photo-1092644.jpeg?auto=compress&cs=tinysrgb&w=400',
    rating: 4.4,
    sentimentScore: 82,
    price: '$899',
    specs: {
      ram: '12GB',
      battery: '5050 mAh',
      display: '6.7" OLED',
      processor: 'Tensor G3'
    },
    aspects: [
      { aspect: 'Camera Quality', score: 95, positiveCount: 4750, negativeCount: 250 },
      { aspect: 'Battery Life', score: 75, positiveCount: 3750, negativeCount: 1250 },
      { aspect: 'Performance', score: 78, positiveCount: 3900, negativeCount: 1100 },
      { aspect: 'Design', score: 80, positiveCount: 4000, negativeCount: 1000 },
      { aspect: 'Price/Value', score: 85, positiveCount: 4250, negativeCount: 750 }
    ],
    pros: [
      'Incredible AI-powered camera features',
      'Clean Android experience with 7 years of updates',
      'Magic Eraser and Best Take are game changers',
      'Great value for the features'
    ],
    cons: [
      'Tensor G3 not as powerful as competition',
      'Gets warm during intensive tasks',
      'Face unlock not as secure as alternatives',
      'Charging speed slower than rivals'
    ],
    summary: 'Pixel 8 Pro shines with its AI camera features and clean software experience. Google promises 7 years of updates. However, the Tensor G3 chip lags behind competitors in raw performance.',
    trendData: [
      { month: 'Jan', positive: 78, negative: 14, neutral: 8 },
      { month: 'Feb', positive: 80, negative: 13, neutral: 7 },
      { month: 'Mar', positive: 82, negative: 12, neutral: 6 },
      { month: 'Apr', positive: 82, negative: 12, neutral: 6 },
      { month: 'May', positive: 81, negative: 13, neutral: 6 },
      { month: 'Jun', positive: 82, negative: 12, neutral: 6 }
    ]
  },
  {
    id: '4',
    name: 'OnePlus 12',
    brand: 'OnePlus',
    model: 'CPH2581',
    image: 'https://images.pexels.com/photos/699122/pexels-photo-699122.jpeg?auto=compress&cs=tinysrgb&w=400',
    rating: 4.5,
    sentimentScore: 86,
    price: '$799',
    specs: {
      ram: '16GB',
      battery: '5400 mAh',
      display: '6.82" AMOLED',
      processor: 'Snapdragon 8 Gen 3'
    },
    aspects: [
      { aspect: 'Camera Quality', score: 82, positiveCount: 4100, negativeCount: 900 },
      { aspect: 'Battery Life', score: 92, positiveCount: 4600, negativeCount: 400 },
      { aspect: 'Performance', score: 94, positiveCount: 4700, negativeCount: 300 },
      { aspect: 'Design', score: 85, positiveCount: 4250, negativeCount: 750 },
      { aspect: 'Price/Value', score: 90, positiveCount: 4500, negativeCount: 500 }
    ],
    pros: [
      'Flagship performance at mid-range price',
      'Incredible 100W fast charging',
      'Massive battery with excellent longevity',
      '16GB RAM handles everything smoothly'
    ],
    cons: [
      'Camera not quite flagship level',
      'Software updates slower than competitors',
      'No wireless charging support',
      'Limited availability in some regions'
    ],
    summary: 'OnePlus 12 offers flagship specs at a more accessible price. The 100W charging and massive battery are standout features. Camera performance is good but not class-leading.',
    trendData: [
      { month: 'Jan', positive: 82, negative: 11, neutral: 7 },
      { month: 'Feb', positive: 84, negative: 10, neutral: 6 },
      { month: 'Mar', positive: 86, negative: 9, neutral: 5 },
      { month: 'Apr', positive: 86, negative: 9, neutral: 5 },
      { month: 'May', positive: 85, negative: 10, neutral: 5 },
      { month: 'Jun', positive: 86, negative: 9, neutral: 5 }
    ]
  }
];
