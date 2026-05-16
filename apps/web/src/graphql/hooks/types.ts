export interface GraphqlMutationState<TData, TVariables> extends GraphqlOperationState<TData> {
  execute: (variables: TVariables) => Promise<null | TData>;
}

export interface GraphqlMutationStateWithoutVariables<TData> extends GraphqlOperationState<TData> {
  execute: () => Promise<null | TData>;
}

export interface GraphqlOperationState<TData> {
  data: null | TData;
  error: null | string;
  loading: boolean;
}
