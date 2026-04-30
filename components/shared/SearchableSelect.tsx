'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, X, Check } from 'lucide-react'

interface Option {
    name: string
    code: string
}

interface SearchableSelectProps {
    options: Option[]
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
}

export default function SearchableSelect({ 
    options, 
    value, 
    onChange, 
    placeholder = 'Select country...',
    className = ''
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const filteredOptions = options.filter(option =>
        option.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const selectedOption = options.find(opt => opt.name === value)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleToggle = () => {
        const nextState = !isOpen
        setIsOpen(nextState)
        if (nextState) {
            setSearchTerm('')
            // Focus input after dropdown opens
            setTimeout(() => inputRef.current?.focus(), 100)
        }
    }

    const handleSelect = (optionName: string) => {
        onChange(optionName)
        setIsOpen(false)
        setSearchTerm('')
    }

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div 
                onClick={handleToggle}
                className="input-field flex items-center justify-between cursor-pointer bg-white min-h-[42px]"
            >
                <span className={`truncate ${!value ? 'text-text-400' : 'text-navy-900 font-medium'}`}>
                    {selectedOption ? selectedOption.name : placeholder}
                </span>
                <ChevronDown size={16} className={`text-text-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute z-[100] w-full mt-2 bg-white border border-surface-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2 border-b border-surface-100 flex items-center gap-2 bg-surface-50">
                        <Search size={14} className="text-text-400 shrink-0" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search countries..."
                            className="w-full bg-transparent border-none outline-none text-sm text-navy-900 py-1"
                            onClick={(e) => e.stopPropagation()}
                        />
                        {searchTerm && (
                            <button 
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setSearchTerm('')
                                    inputRef.current?.focus()
                                }} 
                                className="text-text-300 hover:text-text-500 p-1"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <div className="max-h-[250px] overflow-y-auto scrollbar-thin">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => (
                                <div
                                    key={option.code}
                                    onClick={() => handleSelect(option.name)}
                                    className={`px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between transition-colors
                                        ${option.name === value ? 'bg-navy-50 text-navy-900 font-semibold' : 'text-text-700 hover:bg-surface-50'}`}
                                >
                                    <span className="truncate">{option.name}</span>
                                    {option.name === value && <Check size={14} className="text-navy-600" />}
                                </div>
                            ))
                        ) : (
                            <div className="px-4 py-8 text-center text-text-400 text-xs italic">
                                No countries found for "{searchTerm}"
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
