import { useState, useCallback } from 'react';

export function useToast(duration = 3000) {
  const [toast, setToast] = useState('');

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(''), duration);
  }, [duration]);

  return { toast, showToast };
}
