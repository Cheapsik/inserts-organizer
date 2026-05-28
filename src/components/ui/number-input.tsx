import * as React from "react";
import { cn } from "@/lib/utils";

interface NumberInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value" | "type"
> {
  value: number;
  onChange: (value: number) => void;
  allowEmpty?: boolean;
}

/**
 * Number input that allows clearing and retyping without the "stuck zero" problem.
 * Internally uses a string state so the user can freely type.
 */
const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, value, onChange, min, max, allowEmpty, ...props }, ref) => {
    const [raw, setRaw] = React.useState(String(value));
    const prevValue = React.useRef(value);

    // Sync from parent when value changes externally
    React.useEffect(() => {
      if (value !== prevValue.current) {
        setRaw(String(value));
        prevValue.current = value;
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const text = e.target.value;
      // Allow empty, minus sign, or valid number chars
      if (text === "" || text === "-") {
        setRaw(text);
        return;
      }
      const num = Number(text);
      if (isNaN(num)) return;
      setRaw(text);
      let clamped = num;
      if (min !== undefined) clamped = Math.max(Number(min), clamped);
      if (max !== undefined) clamped = Math.min(Number(max), clamped);
      prevValue.current = clamped;
      onChange(clamped);
    };

    const handleBlur = () => {
      if (raw === "" || raw === "-") {
        const fallback = typeof min === "number" ? min : 0;
        setRaw(String(fallback));
        prevValue.current = fallback;
        onChange(fallback);
      } else {
        // Re-clamp on blur
        let num = Number(raw);
        if (min !== undefined) num = Math.max(Number(min), num);
        if (max !== undefined) num = Math.min(Number(max), num);
        setRaw(String(num));
        prevValue.current = num;
        onChange(num);
      }
    };

    return (
      <input
        type="text"
        inputMode="numeric"
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        value={raw}
        onChange={handleChange}
        onBlur={handleBlur}
        {...props}
      />
    );
  },
);
NumberInput.displayName = "NumberInput";

export { NumberInput };
