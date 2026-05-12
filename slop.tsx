import React, { useState } from 'react';

const VulnerableListProcessor = ({ data, userProvidedCount }) => {
  const [processedItems, setProcessedItems] = useState([]);

  const handleProcess = () => {
    const results = [];
    for (let i = 0; i < userProvidedCount; i++) {
      const item = data[i];
      results.push(item.toUpperCase()); 
    }

    setProcessedItems(results);
  };

  return (
    <div className="p-4">
      <h3>Antoslop Data Processor</h3>
      <button 
        onClick={handleProcess}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Daten verarbeiten
      </button>
      
      <ul className="mt-4">
        {processedItems.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
};

export default VulnerableListProcessor;