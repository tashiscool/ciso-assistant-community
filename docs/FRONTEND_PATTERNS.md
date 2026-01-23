# CISO Assistant Frontend Architecture & UI/UX Patterns

## Quick Reference for New Feature Development

This document provides patterns and guidelines for implementing new features (Kanban, Wayfinder, FedRAMP 20x) that seamlessly integrate with the existing UI/UX.

---

## 1. Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | SvelteKit | 2.x |
| Styling | Tailwind CSS | 4.1.11 |
| UI Components | Skeleton Labs | 3.1.3 |
| Icons | FontAwesome 6.7.2 + Lucide Svelte | |
| Charts | ECharts | 6.0.0 |
| Forms | SuperForms + Zod | |
| Data Tables | @vincjo/datatables | Remote pagination |
| i18n | Paraglide | 22 languages |

---

## 2. Directory Structure for New Features

```
frontend/src/
├── lib/
│   ├── components/
│   │   ├── Kanban/                    # New: Kanban components
│   │   │   ├── KanbanBoard.svelte
│   │   │   ├── KanbanColumn.svelte
│   │   │   ├── KanbanCard.svelte
│   │   │   └── index.ts
│   │   ├── Wayfinder/                 # New: Workflow wizard
│   │   │   ├── WorkflowWizard.svelte
│   │   │   ├── WorkflowStep.svelte
│   │   │   ├── StepIndicator.svelte
│   │   │   └── index.ts
│   │   └── FedRAMP20x/                # New: FedRAMP 20x components
│   │       ├── KSICard.svelte
│   │       ├── KSIHeatmap.svelte
│   │       ├── ValidationStatus.svelte
│   │       └── index.ts
│   └── services/
│       ├── kanban/api.ts              # New: Kanban API service
│       ├── wayfinder/api.ts           # New: Wayfinder API service
│       └── fedramp20x/api.ts          # New: FedRAMP 20x API service
├── routes/(app)/(internal)/
│   ├── kanban/                        # New: Kanban routes
│   ├── wayfinder/                     # New: Wayfinder routes
│   └── fedramp-20x/                   # New: FedRAMP 20x routes
```

---

## 3. Component Patterns

### 3.1 Props Interface Pattern (Svelte 5 Runes)

```svelte
<script lang="ts">
  interface Props {
    // Required props
    title: string;
    data: SomeType[];

    // Optional props with defaults
    variant?: 'primary' | 'secondary';
    disabled?: boolean;

    // Bindable props (two-way)
    selected?: string;

    // Snippet slots
    header?: import('svelte').Snippet;
    actions?: import('svelte').Snippet<[item: SomeType]>;
  }

  let {
    title,
    data,
    variant = 'primary',
    disabled = false,
    selected = $bindable(),
    header,
    actions
  }: Props = $props();
</script>
```

### 3.2 State Management Pattern

```typescript
// Use $state for local reactive state
let items = $state<Item[]>([]);
let loading = $state(false);

// Use $derived for computed values
let totalCount = $derived(items.length);
let filteredItems = $derived(items.filter(i => i.active));

// Use $effect for side effects
$effect(() => {
  if (selected) {
    fetchDetails(selected);
  }
});
```

### 3.3 Card Component Pattern (Dashboard Widgets)

```svelte
<!-- Follow the CounterCard.svelte pattern -->
<script lang="ts">
  interface Props {
    count?: number;
    label: string;
    faIcon?: string;
    iconColor?: string;
    href?: string;
    children?: import('svelte').Snippet;
  }

  let { count = 0, label, faIcon = '', iconColor = '', href, children }: Props = $props();
</script>

<div
  class="card p-4 w-full flex flex-col whitespace-normal group transition-all duration-200
         bg-gradient-to-br from-white via-white to-violet-25
         border border-gray-100 shadow-sm hover:shadow-lg hover:border-violet-200
         {href ? 'cursor-pointer hover:scale-[1.02] hover:-translate-y-1' : ''}"
  onclick={() => href && goto(href)}
  role={href ? 'button' : ''}
>
  <div class="text-xs font-medium text-gray-600 uppercase tracking-wide mb-3">
    {label}
  </div>
  <div class="flex flex-row items-center justify-between">
    {#if faIcon}
      <div class="text-3xl {iconColor || 'text-violet-500'} mr-3">
        <i class={faIcon}></i>
      </div>
    {/if}
    <div class="text-4xl font-bold text-gray-800">
      {count?.toLocaleString()}
    </div>
    {@render children?.()}
  </div>
</div>
```

### 3.4 Status Badge Pattern

```svelte
<script lang="ts">
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'completed': 'bg-green-100 text-green-800',
      'in_progress': 'bg-blue-100 text-blue-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'failed': 'bg-red-100 text-red-800',
      'not_started': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };
</script>

<span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
  {status}
</span>
```

---

## 4. Modal System

### 4.1 Triggering a Modal

```svelte
<script lang="ts">
  import { getModalStore } from '$lib/components/Modals/stores';
  import CreateModal from '$lib/components/Modals/CreateModal.svelte';

  const modalStore = getModalStore();

  function openCreateModal() {
    modalStore.trigger({
      type: 'component',
      component: {
        ref: CreateModal,
        props: {
          form: data.createForm,
          model: data.model
        }
      },
      title: 'Create New Item'
    });
  }
</script>

<button class="btn preset-filled-primary-500" onclick={openCreateModal}>
  <i class="fa-solid fa-plus mr-2"></i>
  Add New
</button>
```

### 4.2 Creating a Custom Modal

```svelte
<!-- CustomModal.svelte -->
<script lang="ts">
  import { getModalStore } from '$lib/components/Modals/stores';

  interface Props {
    parent: any;
    data: SomeType;
    onConfirm?: (result: any) => void;
  }

  let { parent, data, onConfirm }: Props = $props();
  const modalStore = getModalStore();

  function handleConfirm() {
    onConfirm?.(result);
    parent.onClose();
  }
</script>

{#if $modalStore[0]}
  <div class="card bg-surface-50 p-4 w-fit max-w-4xl shadow-xl space-y-4">
    <header class="text-2xl font-bold">
      {$modalStore[0].title}
    </header>

    <!-- Modal content -->
    <div class="space-y-4">
      <!-- Your content here -->
    </div>

    <!-- Actions -->
    <div class="flex justify-end gap-2">
      <button class="btn preset-tonal" onclick={parent.onClose}>
        Cancel
      </button>
      <button class="btn preset-filled-primary-500" onclick={handleConfirm}>
        Confirm
      </button>
    </div>
  </div>
{/if}
```

---

## 5. Form Patterns

### 5.1 Using SuperForms

```svelte
<script lang="ts">
  import Form from '$lib/components/Forms/Form.svelte';
  import TextField from '$lib/components/Forms/TextField.svelte';
  import AutocompleteSelect from '$lib/components/Forms/AutocompleteSelect.svelte';

  let { data }: Props = $props();
</script>

<Form data={data.form} action="?/create">
  {#snippet children({ form, errors })}
    <TextField
      {form}
      field="name"
      label="Name"
      required
    />

    <AutocompleteSelect
      {form}
      field="assignee"
      label="Assignee"
      optionsEndpoint="users"
      optionsLabelField="email"
      multiple={false}
    />

    <button type="submit" class="btn preset-filled-primary-500">
      Submit
    </button>
  {/snippet}
</Form>
```

### 5.2 Available Form Fields

| Component | Use Case |
|-----------|----------|
| `TextField` | Text input, datetime |
| `TextArea` | Multi-line text |
| `MarkdownField` | Rich text with markdown |
| `AutocompleteSelect` | Dropdowns with search, multi-select |
| `Checkbox` | Boolean toggle |
| `Score` | Score/rating selection |
| `FileInput` | File upload |
| `ListSelector` | Add/remove items from list |

---

## 6. API Integration Pattern

### 6.1 Service Layer

```typescript
// frontend/src/lib/services/kanban/api.ts
import { api } from '$lib/api';
import type { ApiResponse } from '$lib/api';

export interface KanbanBoard {
  id: string;
  name: string;
  columns: KanbanColumn[];
}

export interface KanbanCard {
  id: string;
  title: string;
  description: string;
  status: string;
  assignee_id?: string;
  due_date?: string;
}

export async function getBoards(): Promise<ApiResponse<KanbanBoard[]>> {
  return api.get('/kanban/boards/');
}

export async function createCard(
  boardId: string,
  data: Partial<KanbanCard>
): Promise<ApiResponse<KanbanCard>> {
  return api.post(`/kanban/boards/${boardId}/cards/`, data);
}

export async function moveCard(
  cardId: string,
  columnId: string,
  position: number
): Promise<ApiResponse<KanbanCard>> {
  return api.patch(`/kanban/cards/${cardId}/move/`, { column_id: columnId, position });
}
```

### 6.2 Using in Components

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { getBoards, type KanbanBoard } from '$lib/services/kanban/api';

  let boards = $state<KanbanBoard[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    const response = await getBoards();
    if (response.success) {
      boards = response.data;
    } else {
      error = response.message || 'Failed to load boards';
    }
    loading = false;
  });
</script>

{#if loading}
  <div class="flex justify-center p-8">
    <i class="fa-solid fa-spinner fa-spin text-2xl"></i>
  </div>
{:else if error}
  <div class="text-red-600 p-4">{error}</div>
{:else}
  <!-- Render boards -->
{/if}
```

---

## 7. Routing Pattern

### 7.1 Page Structure

```typescript
// +page.server.ts - Data loading
import type { PageServerLoad, Actions } from './$types';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional()
});

export const load: PageServerLoad = async ({ fetch, params }) => {
  const form = await superValidate(zod(schema));

  // Load data from API
  const response = await fetch(`/api/items/${params.id}`);
  const item = await response.json();

  return { form, item };
};

export const actions: Actions = {
  default: async ({ request, fetch }) => {
    const formData = await request.formData();
    // Handle form submission
  }
};
```

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<div class="max-w-7xl mx-auto px-4">
  <!-- Page content -->
</div>
```

### 7.2 Adding Navigation

```typescript
// In navData.ts, add new section:
{
  name: 'workflows',  // Translation key
  items: [
    {
      name: 'kanban',
      fa_icon: 'fa-solid fa-columns',
      href: '/kanban',
      permissions: ['view_kanban']
    },
    {
      name: 'wayfinder',
      fa_icon: 'fa-solid fa-route',
      href: '/wayfinder',
      permissions: ['view_workflow']
    },
    {
      name: 'fedramp20x',
      fa_icon: 'fa-solid fa-shield-check',
      href: '/fedramp-20x',
      permissions: ['view_fedramp']
    }
  ]
}
```

---

## 8. Chart/Visualization Patterns

### 8.1 ECharts Integration

```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    data: { name: string; value: number }[];
    title?: string;
  }

  let { data, title = '' }: Props = $props();

  let chartContainer: HTMLElement;

  onMount(async () => {
    const echarts = await import('echarts');
    const chart = echarts.init(chartContainer, null, { renderer: 'svg' });

    const option = {
      title: { text: title },
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        data: data,
        radius: '65%'
      }]
    };

    chart.setOption(option);

    // Responsive resize
    window.addEventListener('resize', () => chart.resize());

    return () => {
      chart.dispose();
    };
  });
</script>

<div bind:this={chartContainer} class="w-full h-64"></div>
```

### 8.2 Existing Chart Components

| Component | Use Case |
|-----------|----------|
| `RadarChart.svelte` | Multi-axis comparison |
| `DonutChart.svelte` | Proportional data |
| `BarChart.svelte` | Categorical comparison |
| `SankeyChart.svelte` | Flow diagrams |
| `TimeSeriesChart.svelte` | Time-based trends |

---

## 9. Styling Guidelines

### 9.1 Color System

```css
/* Primary colors (violet) */
--color-primary-50 through --color-primary-950

/* Secondary colors (pink) */
--color-secondary-50 through --color-secondary-950

/* Status colors */
.text-green-600   /* Success */
.text-yellow-600  /* Warning */
.text-red-600     /* Error */
.text-blue-600    /* Info */
```

### 9.2 Standard Button Classes

```html
<!-- Primary action -->
<button class="btn preset-filled-primary-500">Primary</button>

<!-- Secondary action -->
<button class="btn preset-tonal">Secondary</button>

<!-- Danger action -->
<button class="btn preset-filled-error-500">Delete</button>

<!-- Mini buttons (table actions) -->
<button class="btn-mini-primary">Action</button>
```

### 9.3 Card Layouts

```html
<!-- Standard card -->
<div class="card bg-white dark:bg-gray-800 shadow rounded-lg p-6">
  <!-- Content -->
</div>

<!-- Gradient card (hero sections) -->
<div class="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-8">
  <!-- Content -->
</div>

<!-- Interactive card -->
<div class="card hover:shadow-lg hover:border-violet-200 transition-all cursor-pointer">
  <!-- Content -->
</div>
```

### 9.4 Grid Layouts

```html
<!-- Dashboard grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <!-- Cards -->
</div>

<!-- Kanban columns -->
<div class="flex gap-4 overflow-x-auto pb-4">
  <!-- Columns -->
</div>

<!-- Form layout -->
<div class="space-y-4 max-w-2xl">
  <!-- Form fields -->
</div>
```

---

## 10. Feature-Specific Guidelines

### 10.1 Kanban Board Implementation

```svelte
<!-- KanbanBoard.svelte -->
<script lang="ts">
  import { dndzone } from 'svelte-dnd-action';
  import KanbanColumn from './KanbanColumn.svelte';
  import KanbanCard from './KanbanCard.svelte';

  interface Column {
    id: string;
    name: string;
    cards: Card[];
  }

  let { columns = $bindable() }: { columns: Column[] } = $props();

  function handleDndConsider(columnId: string, e: CustomEvent) {
    const column = columns.find(c => c.id === columnId);
    if (column) column.cards = e.detail.items;
  }

  function handleDndFinalize(columnId: string, e: CustomEvent) {
    const column = columns.find(c => c.id === columnId);
    if (column) column.cards = e.detail.items;
    // API call to persist
  }
</script>

<div class="flex gap-4 overflow-x-auto p-4 min-h-[600px]">
  {#each columns as column (column.id)}
    <div class="flex-shrink-0 w-80 bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
      <h3 class="font-semibold mb-4 flex items-center justify-between">
        {column.name}
        <span class="text-sm text-gray-500">{column.cards.length}</span>
      </h3>

      <div
        class="space-y-2 min-h-[200px]"
        use:dndzone={{ items: column.cards, flipDurationMs: 200 }}
        onconsider={(e) => handleDndConsider(column.id, e)}
        onfinalize={(e) => handleDndFinalize(column.id, e)}
      >
        {#each column.cards as card (card.id)}
          <KanbanCard {card} />
        {/each}
      </div>
    </div>
  {/each}
</div>
```

### 10.2 Wayfinder/Wizard Implementation

```svelte
<!-- WorkflowWizard.svelte -->
<script lang="ts">
  interface Step {
    id: string;
    title: string;
    description: string;
    component: any;
    completed: boolean;
  }

  let { steps, currentStep = $bindable(0) }: { steps: Step[]; currentStep: number } = $props();

  function goToStep(index: number) {
    if (index <= currentStep || steps[index - 1]?.completed) {
      currentStep = index;
    }
  }

  function nextStep() {
    if (currentStep < steps.length - 1) {
      steps[currentStep].completed = true;
      currentStep++;
    }
  }
</script>

<div class="max-w-4xl mx-auto">
  <!-- Step indicators -->
  <div class="flex items-center justify-between mb-8">
    {#each steps as step, i}
      <button
        class="flex items-center"
        class:opacity-50={i > currentStep && !step.completed}
        onclick={() => goToStep(i)}
      >
        <div class={`w-10 h-10 rounded-full flex items-center justify-center
          ${i === currentStep ? 'bg-violet-600 text-white' :
            step.completed ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>
          {#if step.completed}
            <i class="fa-solid fa-check"></i>
          {:else}
            {i + 1}
          {/if}
        </div>
        <span class="ml-2 font-medium">{step.title}</span>
      </button>

      {#if i < steps.length - 1}
        <div class="flex-1 h-0.5 mx-4 bg-gray-200">
          <div class="h-full bg-violet-600 transition-all"
               style="width: {step.completed ? '100%' : '0%'}"></div>
        </div>
      {/if}
    {/each}
  </div>

  <!-- Step content -->
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
    <svelte:component this={steps[currentStep].component} on:complete={nextStep} />
  </div>
</div>
```

### 10.3 FedRAMP 20x KSI Dashboard

```svelte
<!-- KSIDashboard.svelte -->
<script lang="ts">
  import KSICard from './KSICard.svelte';
  import KSIHeatmap from './KSIHeatmap.svelte';

  interface KSICategory {
    id: string;
    name: string;
    indicators: KSI[];
    compliance: number;
  }

  let { categories }: { categories: KSICategory[] } = $props();

  let automationCoverage = $derived(
    categories.flatMap(c => c.indicators)
      .filter(k => k.machineValidated).length /
    categories.flatMap(c => c.indicators).length * 100
  );
</script>

<div class="space-y-6">
  <!-- Hero metrics -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div class="bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg p-6 text-white">
      <h3 class="text-lg font-medium opacity-90">Overall KSI Compliance</h3>
      <div class="text-5xl font-bold mt-2">
        {Math.round(categories.reduce((sum, c) => sum + c.compliance, 0) / categories.length)}%
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 class="text-lg font-medium text-gray-600">Automation Coverage</h3>
      <div class="text-5xl font-bold text-violet-600 mt-2">
        {Math.round(automationCoverage)}%
      </div>
      <p class="text-sm text-gray-500 mt-1">Target: 70%</p>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 class="text-lg font-medium text-gray-600">Next OAR Due</h3>
      <div class="text-3xl font-bold text-gray-800 mt-2">
        <!-- Calculate from data -->
      </div>
    </div>
  </div>

  <!-- KSI Category Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {#each categories as category}
      <KSICard {category} />
    {/each}
  </div>

  <!-- Heatmap visualization -->
  <KSIHeatmap {categories} />
</div>
```

---

## 11. Testing Patterns

### 11.1 Component Testing

```typescript
// Component.test.ts
import { render, screen, fireEvent } from '@testing-library/svelte';
import KanbanCard from './KanbanCard.svelte';

describe('KanbanCard', () => {
  it('renders card title', () => {
    render(KanbanCard, { props: { card: { id: '1', title: 'Test Task' } } });
    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('opens modal on click', async () => {
    render(KanbanCard, { props: { card: { id: '1', title: 'Test' } } });
    await fireEvent.click(screen.getByRole('button'));
    // Assert modal opened
  });
});
```

---

## 12. Checklist for New Features

Before implementing a new feature, verify:

- [ ] **Component structure** follows existing patterns
- [ ] **Props interface** is properly typed with TypeScript
- [ ] **State management** uses Svelte 5 runes ($state, $derived, $effect)
- [ ] **API service** created in `/lib/services/`
- [ ] **Routing** follows SvelteKit conventions
- [ ] **Navigation** added to `navData.ts` with proper permissions
- [ ] **Modals** use the existing modal store system
- [ ] **Forms** use SuperForms + Zod validation
- [ ] **Styling** uses Tailwind + Skeleton utilities
- [ ] **i18n** keys added to translation files
- [ ] **Dark mode** supported via CSS classes
- [ ] **Responsive** design for mobile/tablet/desktop
- [ ] **Loading states** shown during async operations
- [ ] **Error handling** with user-friendly messages

---

*Last Updated: January 2026*
