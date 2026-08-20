export interface PIIPlaceholder {
  term: string;
  token: string;
  type: 'ROSTER_NAME' | 'NLP_NAME' | 'EMAIL' | 'PHONE' | 'IDENTIFIER';
}
