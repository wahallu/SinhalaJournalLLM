export default function ToolHeader({ title, description }) {
  return (
    <div className="mb-6">
      <h1 id="tool-title" className="text-2xl font-semibold text-gray-900">{title}</h1>
      {description && (
        <p className="text-base text-gray-400 mt-1">{description}</p>
      )}
    </div>
  );
}
