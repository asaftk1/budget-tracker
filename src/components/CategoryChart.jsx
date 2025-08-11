// src/components/CategoryChart.jsx
import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';

// רישום הרכיבים הדרושים ל־chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const CategoryChart = ({ data }) => {
  const categories = Object.keys(data);
  const values = Object.values(data);

  const chartData = {
    labels: categories,
    datasets: [
      {
        label: 'הוצאות לפי קטגוריה',
        data: values,
        backgroundColor: 'rgba(75, 192, 192, 0.7)',
        borderRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    indexAxis: 'y',
    plugins: {
      legend: {
        position: 'top',
      },
    },
    scales: {
      x: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-white p-4 rounded-xl shadow">
      <h2 className="text-xl font-bold mb-4 text-center">התפלגות לפי קטגוריה</h2>
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default CategoryChart;


 