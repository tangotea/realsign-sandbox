"use client";

import { InputHTMLAttributes, useState } from "react";

type PasswordInputProps = InputHTMLAttributes<HTMLInputElement>;

export default function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="password-field">
      <input
        {...props}
        className={["field", className].filter(Boolean).join(" ")}
        type={visible ? "text" : "password"}
      />
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((value) => !value)}
      >
        <span className={`password-eye${visible ? " open" : ""}`} aria-hidden="true" />
      </button>
    </span>
  );
}
