import { useState } from 'react';

function readStoredState(storageKey: string, defaultValue: boolean): boolean {
  const savedState = localStorage.getItem(storageKey);
  return savedState === null ? defaultValue : savedState === 'true';
}

/**
 * Custom hook to manage sidebar collapsed state with localStorage persistence
 * @param defaultValue The default state if nothing is stored in localStorage
 * @param storageKey The key to use for localStorage
 * @returns [collapsed, toggleCollapsed, setCollapsed]
 */
export function useSidebarState(defaultValue = false, storageKey = 'sidebarCollapsed') {
  const [collapsed, setCollapsed] = useState(() => readStoredState(storageKey, defaultValue));

  // Toggle collapsed state and save to localStorage
  const toggleCollapsed = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem(storageKey, newState.toString());
  };

  // Function to directly set state and save to localStorage
  const setSidebarState = (state: boolean) => {
    setCollapsed(state);
    localStorage.setItem(storageKey, state.toString());
  };

  return [collapsed, toggleCollapsed, setSidebarState] as const;
}
