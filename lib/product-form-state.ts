export interface ProductFormState {
  status: "idle" | "error" | "success";
  error: string | null;
  productId: string | null;
}

export const initialProductFormState: ProductFormState = {
  status: "idle",
  error: null,
  productId: null,
};
