import { useState } from "preact/hooks";

export default function SimpleCounter() {
  const [count, setCount] = useState(0);

  return (
    <div style="padding: 2rem; font-family: sans-serif;">
      <h2>Simple Counter</h2>
      <p>Count: <strong>{count}</strong></p>
      <button onClick={() => setCount(count - 1)} style="margin-right: 0.5rem; padding: 0.5rem 1rem;">-</button>
      <button onClick={() => setCount(count + 1)} style="padding: 0.5rem 1rem;">+</button>
    </div>
  );
}
