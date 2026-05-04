import React, { useState, useEffect, useRef } from 'react';
import './Autocomplete.css';

const Autocomplete = ({ 
  options, 
  value, 
  onChange, 
  placeholder, 
  name, 
  required = false,
  className = '' 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [userInput, setUserInput] = useState(value || '');
  const containerRef = useRef(null);

  useEffect(() => {
    setUserInput(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const input = e.target.value;
    setUserInput(input);
    onChange({ target: { name, value: input } });

    if (input.trim() === '') {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const filtered = options.filter(opt => 
      opt.toLowerCase().includes(input.toLowerCase())
    );
    setSuggestions(filtered);
    setIsOpen(true);
  };

  const handleSelect = (option) => {
    setUserInput(option);
    setIsOpen(false);
    onChange({ target: { name, value: option } });
  };

  return (
    <div className={`autocomplete-container ${className}`} ref={containerRef}>
      <input
        type="text"
        name={name}
        value={userInput}
        onChange={handleInputChange}
        onFocus={() => {
          if (userInput.trim() !== '') {
            const filtered = options.filter(opt => 
              opt.toLowerCase().includes(userInput.toLowerCase())
            );
            setSuggestions(filtered);
            setIsOpen(true);
          } else {
            setSuggestions(options);
            setIsOpen(true);
          }
        }}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
      />
      {isOpen && suggestions.length > 0 && (
        <ul className="suggestions-list">
          {suggestions.map((opt, i) => (
            <li key={i} onClick={() => handleSelect(opt)}>
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Autocomplete;
