import React from 'react';
import {connect} from 'react-redux';
import {UpdateTime} from '../common.jsx';

function mapStateToProps(state, ownProps) {
    return {
        canEdit: state.online
    }
}

/* Renders one item statically. */
function ItemInfo({ itemModel, expanded, canEdit, onEdit, onDelete, onClick }) {
    var tr_ctxt_class = "col-md-1 ";
    var status = "";

    if(itemModel.available === 0) {
        tr_ctxt_class += "status-unavailable";
        status = "Unvailable";
    } else {
        tr_ctxt_class += "status-available";
        status = "Available";
    }

    var handleEdit = (ev) => { ev.preventDefault(); ev.stopPropagation(); onEdit(); }
    var handleDelete = (ev) => { ev.preventDefault(); ev.stopPropagation(); onDelete(); }

    return (
        <tr className="list-row" onClick={onClick}>
            <td>
                {(expanded === false) && <span className="glyphicon glyphicon-menu-down text-left"></span>}
                {(expanded === true) && <span className="glyphicon glyphicon-menu-up text-left"></span>}

                {itemModel.name}
                <UpdateTime updated={itemModel.updated} />
                {canEdit && <span onClick={handleEdit} className="glyphicon glyphicon-pencil offset-button"></span>}
                {canEdit && <span onClick={handleDelete} className="glyphicon glyphicon-remove offset-button"></span>}
            </td>
            <td>{status}</td>
            <td className={tr_ctxt_class}>{itemModel.available}</td>
            <td>{itemModel.requested}</td>
            <td>{itemModel.reserved}</td>
            <td>{itemModel.count}</td>
        </tr>
    );
}

export default connect(mapStateToProps)(ItemInfo);
