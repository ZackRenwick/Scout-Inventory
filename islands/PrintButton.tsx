export default function PrintButton({ label = "🖨️ Print Label" }: { label?: string }) {
  return (
    <button
      class="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md cursor-pointer"
      onClick={() => window.print()}
    >
      {label}
    </button>
  );
}
