import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Props = Pick<ComponentProps<typeof Input>, "type" | "aria-label" | "autoComplete" | "value" | "placeholder" | "className" | "disabled"> & {
  configPath: string;
  onChange: (value: string) => void;
};

/** PEMs must remain multiline through both paste and subsequent edits. */
export function ConnectionCredentialInput({ configPath, onChange, type = "password", ...props }: Props) {
  if (configPath === "credentials.privateKey") {
    return <Textarea
      {...props}
      autoComplete="off"
      spellCheck={false}
      onChange={(event) => onChange(event.target.value)}
      onPaste={(event) => {
        event.preventDefault();
        const input = event.currentTarget;
        const pasted = event.clipboardData.getData("text").replace(/\r\n?/g, "\n");
        onChange(input.value.slice(0, input.selectionStart) + pasted + input.value.slice(input.selectionEnd));
      }}
    />;
  }
  return <Input {...props} type={type} onChange={(event) => onChange(event.target.value)} />;
}
