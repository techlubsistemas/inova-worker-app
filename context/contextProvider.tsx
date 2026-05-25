// ContextProvider passthrough — modalContext foi removido por ser orphan.
// Mantido como ponto de extensão para providers futuros.
export function ContextProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
