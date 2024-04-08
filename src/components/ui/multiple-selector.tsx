'use client'

import * as React from 'react'

import {
    Command,
    CommandGroup,
    CommandItem,
    CommandList,
} from '@/components/ui/command'
import { Command as CommandPrimitive, useCommandState } from 'cmdk'
import { forwardRef, useEffect } from 'react'

import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Option {
    value: string
    label: string
    disable?: boolean
    /** fixed option that can't be removed. */
    fixed?: boolean
    /** Group the options by providing key. */
    [key: string]: string | boolean | undefined
}
interface GroupOption {
    [key: string]: Option[]
}

interface MultipleSelectorProps {
    value?: Option[]
    defaultOptions?: Option[]
    /** manually controlled options */
    options?: Option[]
    placeholder?: string
    /** Loading component. */
    loadingIndicator?: React.ReactNode
    /** Empty component. */
    emptyIndicator?: React.ReactNode
    /** Debounce time for async search. Only work with `onSearch`. */
    delay?: number
    /**
     * Only work with `onSearch` prop. Trigger search when `onFocus`.
     * For example, when user click on the input, it will trigger the search to get initial options.
     **/
    triggerSearchOnFocus?: boolean
    /** async search */
    onSearch?: (value: string) => Promise<Option[]>
    onChange?: (options: Option[]) => void
    /** Limit the maximum number of selected options. */
    maxSelected?: number
    /** When the number of selected options exceeds the limit, the onMaxSelected will be called. */
    onMaxSelected?: (maxLimit: number) => void
    /** Hide the placeholder when there are options selected. */
    hidePlaceholderWhenSelected?: boolean
    disabled?: boolean
    /** Group the options base on provided key. */
    groupBy?: string
    className?: string
    badgeClassName?: string
    /**
     * First item selected is a default behavior by cmdk. That is why the default is true.
     * This is a workaround solution by add a dummy item.
     *
     * @reference: https://github.com/pacocoursey/cmdk/issues/171
     */
    selectFirstItem?: boolean
    /** Allow user to create option when there is no option matched. */
    creatable?: boolean
    /** Props of `Command` */
    commandProps?: React.ComponentPropsWithoutRef<typeof Command>
    /** Props of `CommandInput` */
    inputProps?: Omit<
        React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>,
        'value' | 'placeholder' | 'disabled'
    >
}

export interface MultipleSelectorRef {
    selectedValue: Option[]
    input: HTMLInputElement
}

export function useDebounce<T>(value: T, delay?: number): T {
    const [debouncedValue, setDebouncedValue] = React.useState<T>(value)

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay || 500)

        return () => {
            clearTimeout(timer)
        }
    }, [value, delay])

    return debouncedValue
}

function transToGroupOption(options: Option[], groupBy?: string) {
    if (options.length === 0) {
        return {}
    }
    if (!groupBy) {
        return {
            '': options,
        }
    }

    const groupOption: GroupOption = {}
    options.forEach((option) => {
        const key = (option[groupBy] as string) || ''
        if (!groupOption[key]) {
            groupOption[key] = []
        }
        groupOption[key].push(option)
    })
    return groupOption
}

function removePickedOption(groupOption: GroupOption, picked: Option[]) {
    const cloneOption = JSON.parse(JSON.stringify(groupOption)) as GroupOption

    for (const [key, value] of Object.entries(cloneOption)) {
        cloneOption[key] = value.filter(
            (val) => !picked.find((p) => p.value === val.value)
        )
    }
    return cloneOption
}

/**
 * The `CommandEmpty` of shadcn/ui will cause the cmdk empty not rendering correctly.
 * So we create one and copy the `Empty` implementation from `cmdk`.
 *
 * @reference: https://github.com/hsuanyi-chou/shadcn-ui-expansions/issues/34#issuecomment-1949561607
 **/

const CommandEmpty = forwardRef<
    HTMLDivElement,
    React.ComponentProps<typeof CommandPrimitive.Empty>
>(({ className, ...props }, forwardedRef) => {
    const render = useCommandState((state) => state.filtered.count === 0)

    if (!render) return null

    return (
        <div
            ref={forwardedRef}
            className={cn('py-6 text-center text-sm', className)}
            cmdk-empty=""
            role="presentation"
            {...props}
        />
    )
})

CommandEmpty.displayName = 'CommandEmpty'

const MultipleSelector = React.forwardRef<
    MultipleSelectorRef,
    MultipleSelectorProps
>(
    (
        {
            value,
            onChange,
            placeholder,
            defaultOptions: arrayDefaultOptions = [],
            options: arrayOptions,
            delay,
            onSearch,
            loadingIndicator,
            emptyIndicator,
            maxSelected = Number.MAX_SAFE_INTEGER,
            onMaxSelected,
            hidePlaceholderWhenSelected,
            disabled,
            groupBy,
            className,
            badgeClassName,
            selectFirstItem = true,
            creatable = false,
            triggerSearchOnFocus = false,
            commandProps,
            inputProps,
        }: MultipleSelectorProps,
        ref: React.Ref<MultipleSelectorRef>
    ) => {
        const inputRef = React.useRef<HTMLInputElement>(null)
        const [open, setOpen] = React.useState(false)
        const [isLoading, setIsLoading] = React.useState(false)

        const [selected, setSelected] = React.useState<Option[]>(value || [])
        const [options, setOptions] = React.useState<GroupOption>(
            transToGroupOption(arrayDefaultOptions, groupBy)
        )
        const [inputValue, setInputValue] = React.useState('')
        const debouncedSearchTerm = useDebounce(inputValue, delay || 500)

        React.useImperativeHandle(
            ref,
            () => ({
                selectedValue: [...selected],
                input: inputRef.current as HTMLInputElement,
            }),
            [selected]
        )

        const handleUnselect = React.useCallback(
            (option: Option) => {
                const newOptions = selected.filter((s) => s.value !== option.value)
                setSelected(newOptions)
                onChange?.(newOptions)
            },
            [selected]
        )

        const handleKeyDown = React.useCallback(
            (e: React.KeyboardEvent<HTMLDivElement>) => {
                const input = inputRef.current
                if (input) {
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                        if (input.value === '' && selected.length > 0) {
                            handleUnselect(selected[selected.length - 1])
                        }
                    }
                    // This is not a default behaviour of the <input /> field
                    if (e.key === 'Escape') {
                        input.blur()
                    }
                }
            },
            [selected]
        )

        useEffect(() => {
            if (value) {
                setSelected(value)
            }
        }, [value])

        useEffect(() => {
            /** If `onSearch` is provided, do not trigger options updated. */
            if (!arrayOptions || onSearch) {
                return
            }
            const newOption = transToGroupOption(arrayOptions || [], groupBy)
            if (JSON.stringify(newOption) !== JSON.stringify(options)) {
                setOptions(newOption)
            }
        }, [arrayDefaultOptions, arrayOptions, groupBy, onSearch, options])

        useEffect(() => {
            const doSearch = async () => {
                setIsLoading(true)
                const res = await onSearch?.(debouncedSearchTerm)
                setOptions(transToGroupOption(res || [], groupBy))
                setIsLoading(false)
            }

            const exec = async () => {
                if (!onSearch || !open) return

                if (triggerSearchOnFocus) {
                    await doSearch()
                }

                if (debouncedSearchTerm) {
                    await doSearch()
                }
            }

            void exec()
        }, [debouncedSearchTerm, open])

        const CreatableItem = () => {
            if (!creatable) return undefined

            const Item = (
                <CommandItem
                    value={inputValue}
                    className="cursor-pointer"
                    onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                    }}
                    onSelect={(value: string) => {
                        if (selected.length >= maxSelected) {
                            onMaxSelected?.(selected.length)
                            return
                        }
                        setInputValue('')
                        const newOptions = [...selected, { value, label: value }]
                        setSelected(newOptions)
                        onChange?.(newOptions)
                    }}
                >{`Create "${inputValue}"`}</CommandItem>
            )

            // For normal creatable
            if (!onSearch && inputValue.length > 0) {
                return Item
            }

            // For async search creatable. avoid showing creatable item before loading at first.
            if (onSearch && debouncedSearchTerm.length > 0 && !isLoading) {
                return Item
            }

            return undefined
        }

        const EmptyItem = React.useCallback(() => {
            if (!emptyIndicator) return undefined

            // For async search that showing emptyIndicator
            if (onSearch && !creatable && Object.keys(options).length === 0) {
                return (
                    <CommandItem
                        value="-"
                        disabled
                    >
                        {emptyIndicator}
                    </CommandItem>
                )
            }

            return <CommandEmpty>{emptyIndicator}</CommandEmpty>
        }, [creatable, emptyIndicator, onSearch, options])

        const selectables = React.useMemo<GroupOption>(
            () => removePickedOption(options, selected),
            [options, selected]
        )

        /** Avoid Creatable Selector freezing or lagging when paste a long string. */
        const commandFilter = React.useCallback(() => {
            if (commandProps?.filter) {
                return commandProps.filter
            }

            if (creatable) {
                return (value: string, search: string) => {
                    return value.toLowerCase().includes(search.toLowerCase()) ? 1 : -1
                }
            }
            // Using default filter in `cmdk`. We don't have to provide it.
            return undefined
        }, [creatable, commandProps?.filter])

        return (
            <div>
                Multiple selector
            </div>
        )
    }
)

MultipleSelector.displayName = 'MultipleSelector'
export default MultipleSelector