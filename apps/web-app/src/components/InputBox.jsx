export default function InputBox({ value, onChange, placeholder, onSubmit, disabled }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSubmit?.();
    }
  };

  return (
    <textarea
      id="input-box"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      rows={9}
      className="w-full px-4 py-3.5 text-[15px] text-gray-900 placeholder-gray-300
        border border-gray-200 rounded-xl leading-relaxed
        focus:outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-200
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors duration-100"
    />
  );
}
