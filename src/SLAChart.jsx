import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function SLAChart({ tickets = [] }) {
  const safeList = Array.isArray(tickets) ? tickets : [];

  const categoryCounts = {
    Sanitation: 0,
    'Water Supply': 0,
    Electricity: 0,
    Roads: 0,
    'Public Safety': 0,
    'Medical/Fire': 0
  };

  safeList.forEach((t) => {
    if (t && t.category && categoryCounts[t.category] !== undefined) {
      categoryCounts[t.category]++;
    } else {
      categoryCounts['Public Safety']++;
    }
  });

  const chartData = {
    labels: ['Sanitation', 'Water Supply', 'Electricity', 'Roads', 'Public Safety', 'Medical/Fire'],
    datasets: [
      {
        label: 'Active Incident Reports',
        data: [
          categoryCounts['Sanitation'],
          categoryCounts['Water Supply'],
          categoryCounts['Electricity'],
          categoryCounts['Roads'],
          categoryCounts['Public Safety'],
          categoryCounts['Medical/Fire']
        ],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(14, 165, 233, 0.8)',
          'rgba(234, 179, 8, 0.8)',
          'rgba(249, 115, 22, 0.8)',
          'rgba(168, 85, 247, 0.8)',
          'rgba(239, 68, 68, 0.8)'
        ],
        borderColor: [
          '#3b82f6',
          '#0ea5e9',
          '#eab308',
          '#f97316',
          '#a855f7',
          '#ef4444'
        ],
        borderWidth: 1.5,
        borderRadius: 6
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: '#334155',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        ticks: { color: '#94a3b8', font: { size: 10 } },
        grid: { display: false }
      },
      y: {
        ticks: { color: '#94a3b8', stepSize: 1 },
        grid: { color: 'rgba(51, 65, 85, 0.4)' },
        beginAtZero: true
      }
    }
  };

  return (
    <div className="h-64 w-full">
      <Bar data={chartData} options={chartOptions} />
    </div>
  );
}
