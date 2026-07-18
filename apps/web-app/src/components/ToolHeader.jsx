export default function ToolHeader({ title, description }) {
  return (
    <div className="mb-8 text-center flex flex-col items-center justify-center relative">
      {/* Subtle background pill for title */}
      <div className="inline-flex items-center gap-2 mb-2 bg-gray-50/80 px-6 py-2 rounded-full border border-gray-100 shadow-sm">
        <h1 id="tool-title" className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight">{title}</h1>
      </div>
      {description && (
        <p className="text-sm sm:text-base text-gray-500 max-w-lg mx-auto">{description}</p>
      )}
    </div>
  );
}
