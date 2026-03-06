import SimpleCounter from "../islands/SimpleCounter.tsx";

export default function TestPage() {
  return (
    <div style="padding: 2rem; font-family: sans-serif;">
      <h1>Island Test Page</h1>
      <p>If the counter below works, islands are functioning correctly.</p>
      <SimpleCounter />
    </div>
  );
}
