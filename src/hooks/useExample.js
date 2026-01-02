import { useState, useEffect } from 'react';

export default function useExample() {
  const [data, setData] = useState(null);

  useEffect(() => {
    setData('Hello from custom hook!');
  }, []);

  return data;
}
