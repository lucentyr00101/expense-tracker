// Shared between server and client: icon/color choices and the built-in categories.

export type TxType = "expense" | "income";

export const ICON_KEYS = [
  "utensils", "coffee", "car", "bus", "fuel", "house", "zap", "smartphone", "shopping-bag", "shirt",
  "heart-pulse", "dumbbell", "clapperboard", "music", "gamepad", "graduation-cap", "book", "receipt",
  "shield", "plane", "sparkles", "gift", "paw-print", "baby", "wrench", "briefcase", "laptop", "store",
  "trending-up", "hand-coins", "piggy-bank", "wallet", "landmark", "banknote", "tag", "more",
] as const;
export type IconKey = (typeof ICON_KEYS)[number];

// Badge tints for category icons. Identity is always carried by the name too.
export const CATEGORY_COLORS = [
  "#f97316", "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
  "#6366f1", "#a855f7", "#ec4899", "#f43f5e", "#84cc16", "#64748b",
] as const;

type Def = { key: string; name: string; icon: IconKey; color: string; children?: string[] };

export const SYSTEM_CATEGORIES: Record<TxType, Def[]> = {
  expense: [
    { key: "food", name: "Food & Dining", icon: "utensils", color: "#f97316", children: ["Groceries", "Restaurants", "Coffee & Snacks", "Delivery"] },
    { key: "transport", name: "Transportation", icon: "car", color: "#3b82f6", children: ["Fuel", "Public Transit", "Ride-hailing", "Parking & Tolls", "Car Maintenance"] },
    { key: "housing", name: "Housing", icon: "house", color: "#6366f1", children: ["Rent / Mortgage", "Repairs", "Furnishings"] },
    { key: "utilities", name: "Bills & Utilities", icon: "zap", color: "#eab308", children: ["Electricity", "Water", "Internet", "Mobile", "Gas"] },
    { key: "shopping", name: "Shopping", icon: "shopping-bag", color: "#ec4899", children: ["Clothing", "Electronics", "Household Supplies"] },
    { key: "health", name: "Health", icon: "heart-pulse", color: "#f43f5e", children: ["Medicine", "Doctor & Dental", "Fitness"] },
    { key: "entertainment", name: "Entertainment", icon: "clapperboard", color: "#a855f7", children: ["Movies & Events", "Subscriptions", "Games", "Hobbies"] },
    { key: "education", name: "Education", icon: "graduation-cap", color: "#14b8a6", children: ["Tuition", "Books & Supplies", "Courses"] },
    { key: "personal", name: "Personal Care", icon: "sparkles", color: "#06b6d4", children: ["Haircut & Salon", "Toiletries"] },
    { key: "travel", name: "Travel", icon: "plane", color: "#0ea5e9", children: ["Flights", "Accommodation", "Activities"] },
    { key: "insurance", name: "Insurance", icon: "shield", color: "#64748b", children: ["Health Insurance", "Life Insurance", "Vehicle Insurance"] },
    { key: "gifts", name: "Gifts & Donations", icon: "gift", color: "#84cc16", children: ["Gifts", "Charity"] },
    { key: "fees", name: "Fees & Charges", icon: "receipt", color: "#78716c", children: ["Bank Fees", "Taxes", "Interest"] },
    { key: "other-expense", name: "Other", icon: "more", color: "#94a3b8" },
  ],
  income: [
    { key: "salary", name: "Salary", icon: "briefcase", color: "#22c55e", children: ["Base Pay", "Bonus", "Overtime"] },
    { key: "freelance", name: "Freelance", icon: "laptop", color: "#14b8a6" },
    { key: "business", name: "Business", icon: "store", color: "#3b82f6" },
    { key: "investments", name: "Investments", icon: "trending-up", color: "#6366f1", children: ["Dividends", "Interest", "Capital Gains"] },
    { key: "gifts-income", name: "Gifts Received", icon: "gift", color: "#ec4899" },
    { key: "refunds", name: "Refunds", icon: "hand-coins", color: "#eab308" },
    { key: "other-income", name: "Other", icon: "more", color: "#94a3b8" },
  ],
};
