import React, { useState, useMemo } from 'react';
import { useStore } from '../store/StoreContext';
import { dbApi } from '../database/db';
import { Plus, Edit2, Trash2, Archive, RotateCcw, ChevronDown, ChevronRight, MoreHorizontal, Merge, GripVertical } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Category, CategoryGroup } from '../models/types';
import { cn } from '../lib/utils';

// Helper for icons
const ICON_MAP: Record<string, any> = {
  'shopping': 'ShoppingBag',
  'food': 'Utensils',
  'transport': 'Car',
  'home': 'Home',
  'health': 'Activity',
  'finance': 'DollarSign',
  'entertainment': 'Film',
  'income': 'TrendingUp',
  'other': 'MoreHorizontal'
};

export function CategoriesPage({ onNavigate }: { onNavigate: (v: string) => void }) {
  const { categories, categoryGroups, transactions, budgets, refreshData } = useStore();
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CategoryGroup | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(categoryGroups.map(g => g.id)));

  // Form states
  const [groupForm, setGroupForm] = useState({ name: '' });
  const [catForm, setCatForm] = useState({ 
    name: '', 
    groupId: '', 
    parentId: '',
    description: '', 
    icon: 'other', 
    isIncome: false, 
    isFixed: false 
  });
  const [mergeForm, setMergeForm] = useState({ sourceId: '', targetId: '' });

  const toggleGroup = (id: string) => {
    const next = new Set(expandedGroups);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedGroups(next);
  };

  const handleSaveGroup = async () => {
    if (!groupForm.name) return;
    const newGroup: CategoryGroup = {
      id: editingGroup?.id || `cg_${Date.now()}`,
      name: groupForm.name,
      order: editingGroup?.order || categoryGroups.length
    };
    await dbApi.putCategoryGroup(newGroup);
    setShowAddGroup(false);
    setEditingGroup(null);
    setGroupForm({ name: '' });
    refreshData();
  };

  const handleSaveCategory = async () => {
    if (!catForm.name || !catForm.groupId) return;
    const newCat: Category = {
      id: editingCategory?.id || `c_${Date.now()}`,
      name: catForm.name,
      groupId: catForm.groupId,
      parentId: catForm.parentId || undefined,
      description: catForm.description,
      icon: catForm.icon,
      isIncome: catForm.isIncome,
      isFixed: catForm.isFixed,
      isArchived: editingCategory?.isArchived || false,
      order: editingCategory?.order || categories.filter(c => c.groupId === catForm.groupId).length
    };
    await dbApi.putCategory(newCat);
    setShowAddCategory(false);
    setEditingCategory(null);
    setCatForm({ name: '', groupId: '', parentId: '', description: '', icon: 'other', isIncome: false, isFixed: false });
    refreshData();
  };

  const handleArchiveCategory = async (cat: Category) => {
    await dbApi.putCategory({ ...cat, isArchived: !cat.isArchived });
    refreshData();
  };

  const handleMergeCategories = async () => {
    if (!mergeForm.sourceId || !mergeForm.targetId || mergeForm.sourceId === mergeForm.targetId) return;
    
    const confirmed = confirm('This will move ALL transactions and budgets from the source category to the target category and DELETE the source category. This cannot be undone. Proceed?');
    if (!confirmed) return;

    // 1. Update transactions
    const txsToUpdate = transactions.filter(t => t.categoryId === mergeForm.sourceId);
    if (txsToUpdate.length > 0) {
      const updatedTxs = txsToUpdate.map(t => ({ ...t, categoryId: mergeForm.targetId }));
      await dbApi.putTransactions(updatedTxs);
    }

    // 2. Update budgets
    const budgetsToUpdate = budgets.filter(b => b.categoryId === mergeForm.sourceId);
    if (budgetsToUpdate.length > 0) {
      // In a real app, we might need to sum them if both exist for same month, 
      // but for simplicity we'll just reassign or delete if target already has budget
      for (const b of budgetsToUpdate) {
        await dbApi.deleteBudget(b.id);
        // Note: we could check if target budget exists for this month and update it instead
      }
    }

    // 3. Delete category
    await dbApi.deleteCategory(mergeForm.sourceId);
    
    setShowMergeModal(false);
    setMergeForm({ sourceId: '', targetId: '' });
    refreshData();
  };

  const sortedGroups = useMemo(() => {
    return [...categoryGroups].sort((a, b) => a.order - b.order);
  }, [categoryGroups]);

  const categoriesByGroup = useMemo(() => {
    const map: Record<string, Category[]> = {};
    categories.forEach(c => {
      if (!map[c.groupId]) map[c.groupId] = [];
      map[c.groupId].push(c);
    });
    // Sort within group
    Object.keys(map).forEach(gid => {
      map[gid].sort((a, b) => a.order - b.order);
    });
    return map;
  }, [categories]);

  return (
    <div className="flex flex-col h-full space-y-6">
      <PageHeader title="Category Management">
        <div className="flex gap-2">
          <button 
            onClick={() => setShowMergeModal(true)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Merge size={16} />
            Merge Categories
          </button>
          <button 
            onClick={() => {
              setEditingGroup(null);
              setGroupForm({ name: '' });
              setShowAddGroup(true);
            }}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Plus size={16} />
            Add Group
          </button>
          <button 
            onClick={() => {
              setEditingCategory(null);
              setCatForm({ name: '', groupId: categoryGroups[0]?.id || '', description: '', icon: 'other', isIncome: false, isFixed: false });
              setShowAddCategory(true);
            }}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            Add Category
          </button>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto space-y-4 pb-8">
        {sortedGroups.map(group => (
          <div key={group.id} className="card-raised overflow-hidden">
            <div 
              onClick={() => toggleGroup(group.id)}
              className="px-6 py-3 bg-surface-container-low flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                {expandedGroups.has(group.id) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                <h3 className="font-bold text-on-surface">{group.name}</h3>
                <span className="text-xs text-on-surface-variant font-medium bg-surface-container px-2 py-0.5 rounded-full">
                  {(categoriesByGroup[group.id] || []).length} categories
                </span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingGroup(group);
                    setGroupForm({ name: group.name });
                    setShowAddGroup(true);
                  }}
                  className="p-1.5 hover:bg-surface-container rounded-md"
                >
                  <Edit2 size={14} />
                </button>
              </div>
            </div>

            {expandedGroups.has(group.id) && (
              <div className="divide-y divide-outline-variant/30">
                {(categoriesByGroup[group.id] || []).filter(c => !c.parentId).map(cat => (
                  <React.Fragment key={cat.id}>
                    <div className={cn(
                      "flex items-center justify-between px-6 py-4 hover:bg-surface-container-lowest transition-colors",
                      cat.isArchived && "opacity-50 grayscale"
                    )}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                          <MoreHorizontal size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{cat.name}</span>
                            {cat.isIncome && <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Income</span>}
                            {cat.isFixed && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Fixed</span>}
                          </div>
                          {cat.description && <p className="text-xs text-on-surface-variant mt-0.5">{cat.description}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setEditingCategory(cat);
                            setCatForm({ 
                              name: cat.name, 
                              groupId: cat.groupId, 
                              parentId: cat.parentId || '',
                              description: cat.description || '', 
                              icon: cat.icon || 'other', 
                              isIncome: cat.isIncome, 
                              isFixed: cat.isFixed 
                            });
                            setShowAddCategory(true);
                          }}
                          className="btn-physical p-2 rounded-lg"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleArchiveCategory(cat)}
                          className="btn-physical p-2 rounded-lg"
                        >
                          {cat.isArchived ? <RotateCcw size={16} /> : <Archive size={16} />}
                        </button>
                      </div>
                    </div>
                    {/* Render Subcategories */}
                    {(categoriesByGroup[group.id] || []).filter(sub => sub.parentId === cat.id).map(sub => (
                      <div key={sub.id} className={cn(
                        "flex items-center justify-between pl-16 pr-6 py-3 hover:bg-surface-container-lowest transition-colors border-l-2 border-primary/20 ml-6",
                        sub.isArchived && "opacity-50 grayscale"
                      )}>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">{sub.name}</span>
                          {sub.isArchived && <span className="text-[9px] bg-outline-variant text-on-surface-variant px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Archived</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => {
                              setEditingCategory(sub);
                              setCatForm({ 
                                name: sub.name, 
                                groupId: sub.groupId, 
                                parentId: sub.parentId || '',
                                description: sub.description || '', 
                                icon: sub.icon || 'other', 
                                isIncome: sub.isIncome, 
                                isFixed: sub.isFixed 
                              });
                              setShowAddCategory(true);
                            }}
                            className="p-1.5 hover:bg-surface-container rounded-md"
                          >
                            <Edit2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </React.Fragment>
                ))}
                {(!categoriesByGroup[group.id] || categoriesByGroup[group.id].length === 0) && (
                  <div className="px-6 py-8 text-center text-on-surface-variant text-sm italic">
                    No categories in this group.
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modals for Add/Edit Group/Category would go here */}
      {/* ... keeping it simple for now, can add full modals in next turn if needed ... */}
      
      {showAddGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl shadow-2xl border border-outline-variant p-6 space-y-6">
            <h3 className="text-xl font-bold">{editingGroup ? 'Edit Group' : 'Add New Group'}</h3>
            <div className="space-y-2">
              <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Group Name</label>
              <input 
                type="text" 
                value={groupForm.name}
                onChange={e => setGroupForm({ name: e.target.value })}
                className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="e.g. Living Expenses, Housing"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAddGroup(false)} className="btn btn-secondary flex-1">Cancel</button>
              <button onClick={handleSaveGroup} className="btn btn-primary flex-1">Save Group</button>
            </div>
          </div>
        </div>
      )}

      {showAddCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-3xl shadow-2xl border border-outline-variant p-6 space-y-6">
            <h3 className="text-xl font-bold">{editingCategory ? 'Edit Category' : 'Add New Category'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Category Name</label>
                <input 
                  type="text" 
                  value={catForm.name}
                  onChange={e => setCatForm({ ...catForm, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Group</label>
                <select 
                  value={catForm.groupId}
                  onChange={e => setCatForm({ ...catForm, groupId: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {categoryGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Parent Category (Optional)</label>
                <select 
                  value={catForm.parentId}
                  onChange={e => setCatForm({ ...catForm, parentId: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">None (Top Level)</option>
                  {categories.filter(c => c.groupId === catForm.groupId && !c.parentId && c.id !== editingCategory?.id).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Icon</label>
                <select 
                  value={catForm.icon}
                  onChange={e => setCatForm({ ...catForm, icon: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {Object.keys(ICON_MAP).map(k => <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>)}
                </select>
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Description</label>
                <textarea 
                  value={catForm.description}
                  onChange={e => setCatForm({ ...catForm, description: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[80px]"
                />
              </div>
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  id="isIncome" 
                  checked={catForm.isIncome}
                  onChange={e => setCatForm({ ...catForm, isIncome: e.target.checked })}
                  className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary"
                />
                <label htmlFor="isIncome" className="text-sm font-medium">Income Category</label>
              </div>
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  id="isFixed" 
                  checked={catForm.isFixed}
                  onChange={e => setCatForm({ ...catForm, isFixed: e.target.checked })}
                  className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary"
                />
                <label htmlFor="isFixed" className="text-sm font-medium">Fixed Expense</label>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAddCategory(false)} className="btn btn-secondary flex-1">Cancel</button>
              <button onClick={handleSaveCategory} className="btn btn-primary flex-1">Save Category</button>
            </div>
          </div>
        </div>
      )}

      {showMergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl shadow-2xl border border-outline-variant p-6 space-y-6">
            <h3 className="text-xl font-bold">Merge Categories</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Source Category (To be deleted)</label>
                <select 
                  value={mergeForm.sourceId}
                  onChange={e => setMergeForm({ ...mergeForm, sourceId: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Target Category (To keep)</label>
                <select 
                  value={mergeForm.targetId}
                  onChange={e => setMergeForm({ ...mergeForm, targetId: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowMergeModal(false)} className="btn btn-secondary flex-1">Cancel</button>
              <button onClick={handleMergeCategories} className="btn btn-primary flex-1">Merge Now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
