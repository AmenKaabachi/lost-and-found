const declarations = [
  {
    id: 'decl-001',
    title: 'Black Samsung phone',
    description: 'Black Samsung phone found near the university library',
    type: 'lost',
    category: 'electronics',
    status: 'active',
    userId: 'user-001',
  },
  {
    id: 'decl-002',
    title: 'Blue backpack',
    description: 'Blue backpack left in the main lecture hall',
    type: 'found',
    category: 'bags',
    status: 'active',
    userId: 'user-002',
  },
];

export const demoRepository = {
  list: () => [...declarations],
  findById: (id) => declarations.find((declaration) => declaration.id === id),
  create: (input) => {
    const declaration = {
      ...input,
      id: `decl-${String(declarations.length + 1).padStart(3, '0')}`,
      status: 'active',
      userId: 'user-demo',
    };
    declarations.push(declaration);
    return declaration;
  },
  remove: (id) => {
    const index = declarations.findIndex((declaration) => declaration.id === id);
    if (index < 0) return false;
    declarations.splice(index, 1);
    return true;
  },
};

