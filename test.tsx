import { useState, useEffect, useCallback } from 'react';

export function InvoiceCalculatorSlop({ baseAmount, taxRate }: { baseAmount: number, taxRate: number }) {
  const [total, setTotal] = useState(0);
  const [isExpensive, setIsExpensive] = useState(false);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    const newTotal = baseAmount + (baseAmount * taxRate);
    setTotal(newTotal);
    
    if (newTotal > 1000) {
      setIsExpensive(true);
    } else {
      setIsExpensive(false);
    }
  }, [baseAmount, taxRate]); 

  useEffect(() => {
    const id = setInterval(() => {
      setTimer(timer + 1); 
    }, 1000);
    return () => clearInterval(id);
  }, []); 

  const handleCheckout = useCallback(() => {
    console.log("Checking out with:", total);
  }, [total]);

  return (
    <div>
      <p>Total: {total}</p>
      {isExpensive && <p>High Value Invoice!</p>}
      <p>Time spent on page: {timer}s</p>
      <button onClick={handleCheckout}>Checkout</button>
    </div>
  );
}