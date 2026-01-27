"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

interface OrgSwitchContextProps {
	isSwitching: boolean;
	setIsSwitching: React.Dispatch<React.SetStateAction<boolean>>;
}

const OrgSwitchContext = createContext<OrgSwitchContextProps | null>(null);

export function OrgSwitchProvider({ children }: { children: ReactNode }) {
	const [isSwitching, setIsSwitching] = useState(false);

	return (
		<OrgSwitchContext.Provider value={{ isSwitching, setIsSwitching }}>
			{children}
		</OrgSwitchContext.Provider>
	);
}

export function useOrgSwitch() {
	const context = useContext(OrgSwitchContext);
	if (!context) {
		throw new Error("useOrgSwitch must be used within a OrgSwitchProvider");
	}
	return context;
}
