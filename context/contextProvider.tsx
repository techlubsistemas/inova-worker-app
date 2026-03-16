import { ModalProvider } from "./modalContext";

export function ContextProvider({ children }: { children: React.ReactNode }) {
  return <ModalProvider>{children}</ModalProvider>;
}
