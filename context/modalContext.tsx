import React, {
  Dispatch,
  SetStateAction,
  createContext,
  useContext,
  useState,
} from "react";
import type { Tutorial } from "@/types/tutorial";

// Interface para tipar os dados do item modal
interface ItemModalData {
  id: number;
  name: string;
  quantity: number;
  image: string;
}

// Interface para o contexto de modais
interface ModalContextType {
  isLessonModalOpen: boolean;
  openLessonModal: () => void;
  closeLessonModal: () => void;
  isItemModalOpen: boolean;
  openItemModal: () => void;
  closeItemModal: () => void;
  itemModalData: ItemModalData;
  setItemModalData: Dispatch<SetStateAction<ItemModalData>>;
  selectedTutorial: Tutorial | null;
  openTutorialModal: (tutorial: Tutorial) => void;
  closeTutorialModal: () => void;
}

// Valor padrão para o contexto
const ModalContext = createContext<ModalContextType>({
  isLessonModalOpen: false,
  openLessonModal: () => {},
  closeLessonModal: () => {},
  isItemModalOpen: false,
  openItemModal: () => {},
  closeItemModal: () => {},
  itemModalData: { id: 0, name: "", quantity: 0, image: "" },
  setItemModalData: () => {},
  selectedTutorial: null,
  openTutorialModal: () => {},
  closeTutorialModal: () => {},
});

export const ModalProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLessonModalOpen, setLessonModalOpen] = useState(false);
  const [isItemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalData, setItemModalData] = useState<ItemModalData>({
    id: 0,
    name: "",
    quantity: 0,
    image: "",
  });
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);

  const openLessonModal = () => setLessonModalOpen(true);
  const closeLessonModal = () => setLessonModalOpen(false);
  const openItemModal = () => setItemModalOpen(true);
  const closeItemModal = () => setItemModalOpen(false);
  const openTutorialModal = (tutorial: Tutorial) => setSelectedTutorial(tutorial);
  const closeTutorialModal = () => setSelectedTutorial(null);

  return (
    <ModalContext.Provider
      value={{
        isLessonModalOpen,
        openLessonModal,
        closeLessonModal,
        isItemModalOpen,
        openItemModal,
        closeItemModal,
        itemModalData,
        setItemModalData,
        selectedTutorial,
        openTutorialModal,
        closeTutorialModal,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
};

// Hook para consumo do contexto
export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal deve ser usado dentro de um ModalProvider");
  }
  return context;
};

export default ModalContext;
