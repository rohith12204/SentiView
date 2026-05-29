import { createContext, useContext, useState, ReactNode } from 'react';

export type Page =
  | 'home' | 'search' | 'trending' | 'compare' | 'timeline' | 'insights'
  | 'signin' | 'signup' | 'sentiment' | 'fake' | 'fake-analysis'
  | 'cart' | 'orders' | 'admin' | 'keyword-drilldown';

interface AppContextType {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedProducts: string[];
  setSelectedProducts: (products: string[]) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentPage, setCurrentPage]         = useState<Page>('home');
  const [searchQuery, setSearchQuery]         = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  return (
    <AppContext.Provider value={{
      currentPage, setCurrentPage,
      searchQuery, setSearchQuery,
      selectedProducts, setSelectedProducts,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
