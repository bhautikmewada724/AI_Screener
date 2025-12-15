import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type Theme = 'light' | 'dark';

interface UiState {
  theme: Theme;
  isSidebarCollapsed: boolean;
  activeModal: string | null;
}

const initialState: UiState = {
  theme: 'light',
  isSidebarCollapsed: false,
  activeModal: null
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<Theme>) => {
      state.theme = action.payload;
    },
    toggleSidebar: (state) => {
      state.isSidebarCollapsed = !state.isSidebarCollapsed;
    },
    openModal: (state, action: PayloadAction<string>) => {
      state.activeModal = action.payload;
    },
    closeModal: (state) => {
      state.activeModal = null;
    }
  }
});

export const { setTheme, toggleSidebar, openModal, closeModal } = uiSlice.actions;

export default uiSlice.reducer;

