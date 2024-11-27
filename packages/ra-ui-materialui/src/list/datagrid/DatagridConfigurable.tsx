import {
    usePreference,
    useResourceContext,
    useStore,
    useTranslate,
} from 'ra-core';
import * as React from 'react';

import { Configurable } from '../../preferences';
import { Datagrid, DatagridProps } from './Datagrid';
import { DatagridEditor } from './DatagridEditor';

/**
 * A Datagrid that users can customize in configuration mode
 *
 * @example
 * import {
 *     List,
 *     DatagridConfigurable,
 *     TextField,
 * } from 'react-admin';
 *
 * export const PostList = () => (
 *     <List>
 *         <DatagridConfigurable>
 *             <TextField source="id" />
 *             <TextField source="title" />
 *             <TextField source="author" />
 *             <TextField source="year" />
 *         </DatagridConfigurable>
 *     </List>
 * );
 */
export const DatagridConfigurable = ({
    preferenceKey,
    omit,
    ...props
}: DatagridConfigurableProps) => {
    if (props.optimized) {
        throw new Error(
            'DatagridConfigurable does not support the optimized prop'
        );
    }

    const translate = useTranslate();
    const resource = useResourceContext(props);
    const finalPreferenceKey = preferenceKey || `${resource}.datagrid`;

    const [availableColumns, setAvailableColumns] = useStore<
        ConfigurableDatagridColumn[]
    >(`preferences.${finalPreferenceKey}.availableColumns`, []);

    const [columns, setColumns] = useStore<string[]>(
        `preferences.${finalPreferenceKey}.columns`,
        []
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, setOmit] = useStore<string[] | undefined>(
        `preferences.${finalPreferenceKey}.omit`,
        omit
    );

    React.useEffect(() => {
        // first render, or the preference have been cleared
        const newAvailableColumns: ConfigurableDatagridColumn[] = React.Children.toArray(
            props.children
        )
            .filter(child => React.isValidElement(child))
            .map((child: React.ReactElement, index) => {
                return {
                    index: String(index),
                    source: child.props.source,
                    label:
                        child.props.label &&
                        typeof child.props.label === 'string' // this list is serializable, so we can't store ReactElement in it
                            ? child.props.label
                            : child.props.label?.props?.label &&
                              typeof child.props.label.props.label === 'string'
                            ? child.props.label.props.label
                            : child.props.source
                            ? //  force the label to be the source
                              undefined
                            : // no source or label, generate a label
                              translate('ra.configurable.Datagrid.unlabeled', {
                                  column: index,
                                  _: `Unlabeled column #%{column}`,
                              }),
                };
            });

        const changedColumns = newAvailableColumns.filter(column => {
            const availableColumn = availableColumns.find(
                availableColumn =>
                    (!!availableColumn.source &&
                        availableColumn.source === column.source) ||
                    (!availableColumn.source &&
                        !!availableColumn.label &&
                        availableColumn.label === column.label)
            );
            return !availableColumn || availableColumn.index !== column.index;
        });
        if (changedColumns.length > 0) {
            // first we need to update the columns indexes to match the new availableColumns so we keep the same order
            const newColumnsSortedAsOldColumns = columns.flatMap(column => {
                const oldColumn = availableColumns.find(
                    availableColumn => availableColumn.index === column
                );
                const newColumn = newAvailableColumns.find(
                    availableColumn =>
                        (!!availableColumn.source &&
                            availableColumn.source === oldColumn?.source) ||
                        (!availableColumn.source &&
                            !!availableColumn.label &&
                            availableColumn.label === oldColumn?.label)
                );
                return newColumn?.index ? [newColumn.index] : [];
            });
            const newColumns = [
                // we add the old columns in the same order as before
                ...newColumnsSortedAsOldColumns,
                // then we add at the new columns which are not omited
                ...newAvailableColumns
                    .filter(
                        c =>
                            (!availableColumns.some(
                                ac =>
                                    (!!ac.source && ac.source === c.source) ||
                                    (!ac.source &&
                                        !!ac.label &&
                                        ac.label === c.label)
                            ) ||
                                newColumnsSortedAsOldColumns?.length === 0) &&
                            !omit?.includes(c.source as string)
                    )
                    .map(c => c.index),
            ];
            setColumns(newColumns);

            // Then we update the available columns to include the new columns while keeping the same order as before
            const newAvailableColumnsSortedAsBefore = [
                // First the existing columns, in the same order
                ...(availableColumns
                    .map(oldAvailableColumn =>
                        newAvailableColumns.find(
                            c =>
                                (!!c.source &&
                                    c.source === oldAvailableColumn.source) ||
                                (!c.source &&
                                    !!c.label &&
                                    c.label === oldAvailableColumn.label)
                        )
                    )
                    .filter(c => !!c) as ConfigurableDatagridColumn[]), // Remove undefined columns
                // Then the new columns
                ...newAvailableColumns.filter(
                    c =>
                        !availableColumns.some(
                            ac =>
                                (!!ac.source && ac.source === c.source) ||
                                (!c.source &&
                                    !!ac.label &&
                                    ac.label === c.label)
                        )
                ),
            ];
            setAvailableColumns(newAvailableColumnsSortedAsBefore);
            setOmit(omit);
        }
    }, [availableColumns]); // eslint-disable-line react-hooks/exhaustive-deps

    // Reset to default columns when columns is empty
    React.useEffect(() => {
        if (columns?.length === 0 && availableColumns?.length > 0) {
            setColumns(
                availableColumns
                    .filter(column => !omit?.includes(column.source ?? ''))
                    .map(column => column.index)
            );
        }
    }, [omit, availableColumns, columns]);

    return (
        <Configurable
            editor={<DatagridEditor />}
            preferenceKey={finalPreferenceKey}
            sx={{ display: 'block', minHeight: 2 }}
        >
            <DatagridWithPreferences {...props} />
        </Configurable>
    );
};

export interface DatagridConfigurableProps extends DatagridProps {
    /**
     * Key to use to store the user's preferences for this datagrid.
     *
     * Set to '[resource].datagrid' by default. Pass a custom key if you need
     * to display more than one ConfigurableDatagrid per resource.
     */
    preferenceKey?: string;
    /**
     * columns to hide by default
     *
     * @example
     * // by default, hide the id and author columns
     * // users can choose to show show them in configuration mode
     * const PostList = () => (
     *     <List>
     *         <DatagridConfigurable omit={['id', 'author']}>
     *             <TextField source="id" />
     *             <TextField source="title" />
     *             <TextField source="author" />
     *             <TextField source="year" />
     *         </DatagridConfigurable>
     *     </List>
     * );
     */
    omit?: string[];
}

export interface ConfigurableDatagridColumn {
    index: string;
    source?: string;
    label?: string;
}

/**
 * This Datagrid filters its children depending on preferences
 */
const DatagridWithPreferences = ({ children, ...props }: DatagridProps) => {
    const [availableColumns] = usePreference<ConfigurableDatagridColumn[]>(
        'availableColumns',
        []
    );
    const [omit] = usePreference<string[]>('omit', []);
    const [columns] = usePreference(
        'columns',
        availableColumns
            .filter(column =>
                column.source ? !omit?.includes(column.source) : true
            )
            .map(column => column.index)
    );
    const childrenArray = React.Children.toArray(children);
    return (
        <Datagrid {...props}>
            {columns === undefined
                ? children
                : columns.map(index => childrenArray[index])}
        </Datagrid>
    );
};
