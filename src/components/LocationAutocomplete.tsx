'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, X } from 'lucide-react';

interface Prediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function LocationAutocomplete({ value, onChange, placeholder = 'Location' }: Props) {
  const [input, setInput] = useState(value);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value changes
  useEffect(() => {
    setInput(value);
  }, [value]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!input || input.trim().length < 2) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/places?input=${encodeURIComponent(input)}`);
        const data = await res.json();
        if (data.predictions && data.predictions.length > 0) {
          setPredictions(data.predictions);
          setShowDropdown(true);
        } else {
          setPredictions([]);
          setShowDropdown(false);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input]);

  // Close dropdown when tapping outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (prediction: Prediction) => {
    setInput(prediction.description);
    onChange(prediction.description);
    setPredictions([]);
    setShowDropdown(false);
  };

  const handleClear = () => {
    setInput('');
    onChange('');
    setPredictions([]);
    setShowDropdown(false);
  };

  const handleInputChange = (val: string) => {
    setInput(val);
    // If user clears the field, propagate immediately
    if (!val) onChange('');
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center px-4 py-3.5">
        <input
          type="text"
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-black text-sm placeholder-gray-400 outline-none"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {loading && (
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin ml-2 shrink-0" />
        )}
        {input && !loading && (
          <button onClick={handleClear} className="ml-2 shrink-0 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && predictions.length > 0 && (
        <div className="absolute left-0 right-0 top-full bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden z-50 mt-1">
          {predictions.map((prediction, index) => (
            <button
              key={prediction.placeId}
              onClick={() => handleSelect(prediction)}
              className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 ${
                index < predictions.length - 1 ? 'border-b border-gray-100' : ''
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-black truncate">{prediction.mainText}</p>
                {prediction.secondaryText && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">{prediction.secondaryText}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}