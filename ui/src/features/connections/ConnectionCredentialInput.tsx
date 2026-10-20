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
    />;
  }
  return <Input {...props} type={type} onChange={(event) => onChange(event.target.value)} />;
}
