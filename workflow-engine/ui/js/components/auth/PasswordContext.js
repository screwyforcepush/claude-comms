import React, { createContext, useContext } from 'react';

const PasswordContext = createContext(null);

export function PasswordProvider({ password, children }) {
  return React.createElement(PasswordContext.Provider, { value: password }, children);
}

export function usePassword() {
  return useContext(PasswordContext);
}

export { PasswordContext };
